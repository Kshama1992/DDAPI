import { Inject, Service } from 'typedi';
import UserEntity from '@entity/user.entity';
import BaseService from '@services/base.service';
import MainDataSource from '@src/main-data-source';
import {
	addTwilioChatParticipant,
	addTwilioSMSParticipant,
	createTwilioConversation,
	createTwilioConversationScopedWebhook,
	getTwilioPhoneNumbersForInstantBookble,
	purchaseTwilioPhoneNumberForInstantBooking,
	removeTwilioConversationParticipants,
} from '@helpers/twilio-conversations.helper';
import InstantlyBookableParticipantEntity from '@src/entity/InstantlyBookable-participant.entity';
import loggerHelper from '@utils/helpers/logger.helper';
import VenueEntity from '@entity/venue.entity';
import InvoiceService from './invoice.service';
import InstBookableConversationResp from '@src/dto/response/instBookable-conversation.resp';
import InvoiceEntity from '@src/entity/invoice.entity';
import { sendSMSInstantlyBookable } from '@src/utils/helpers/twilio';
import InstantlyBookableConversationEntity from '@src/entity/InstantlyBookable-conversation.entity';
import InvoiceStatusEntity from '@src/entity/invoice-status.entity';
import { InvoiceStatus } from '@src/utils/invoiceStatus';
import SecurityDepositStatusEntity from '@src/entity/securityDeposit-status.entity';
import { IsNull } from 'typeorm';
import ChangeInvoiceStatusDto from '@src/dto/change-invoice-status.dto';
import { ForbiddenResponse } from '@src/utils/response/forbidden.response';
import ChargeType from 'dd-common-blocks/dist/type/ChargeType';
import SpaceEntity from '@src/entity/space.entity';
import ReservationEntity from '@src/entity/reservation.entity';
import { getReservationData, getReservationTimeString } from '@src/utils/helpers/host-approval-sms.helper';
import ReservationStatus from 'dd-common-blocks/dist/type/ReservationStatus';
import InvoiceItemEntity from '@src/entity/invoice-item.entity';
import HoursType from 'dd-common-blocks/dist/type/HoursType';
import SpaceTypeLogicType from 'dd-common-blocks/dist/type/SpaceTypeLogicType';
import CreditRotationType from 'dd-common-blocks/dist/type/CreditRotationType';
import SubscriptionService from './subscription.service';
import dayjs from 'dayjs';
import { FeatureFlag } from '@src/utils/feature-flag';
import { PHONE_NUMBER_SERVICE_API } from '@src/config';
import { get, post } from 'aws-amplify/api';
import winstonLogger from '@src/utils/helpers/winston-logger';

export enum InstantlyBookableStatus {
	REQUESTBOOKING = 'REQUESTBOOKING',
	REQUESTED = 'REQUESTED',
	DECLINED = 'DECLINED',
	BOOKSPACE = 'BOOKSPACE',
}

@Service()
export default class InstantlyBookableConversationService extends BaseService {
	@Inject()
	invoiceServices: InvoiceService;

	async connect(invoiceId: string, userId: number, venueId: number): Promise<InstBookableConversationResp> {
		const invoiceService = new InvoiceService();
		const friendlyName = `conversation-invoice-${invoiceId}`;
		winstonLogger.info(`starting connection for invoice id ${invoiceId}, user id ${userId} and venue id ${venueId}`);
		let spaceId = '';
		const arr = String(invoiceId).indexOf('-') > -1 ? invoiceId.split('-') : [invoiceId];
		if (arr.length == 1) {
			const invoice = (await invoiceService.singleWithoutUpdate(Number(invoiceId))) as unknown as InvoiceEntity;
			spaceId = String(invoice?.space?.id);
		}
		if (arr.length > 1) {
			spaceId = arr[1];
		}

		const InstBookableconversationRepository = MainDataSource.getRepository(InstantlyBookableConversationEntity);
		try {
			const { conversationSid } = await createTwilioConversation(friendlyName);
			const { webhookSid } = await createTwilioConversationScopedWebhook(conversationSid);

			const newConversation = InstBookableconversationRepository.create({
				friendlyName,
				conversationSid,
				webhookSid,
				spaceId: Number(spaceId),
				isRequested: false,
				venueId: venueId,
				userId: userId,
			});
			const savedConversation = await InstBookableconversationRepository.save(newConversation);
			winstonLogger.info(`New conversation created with id ${savedConversation}`);
			return { conversation: savedConversation, messages: [] };
		} catch (e) {
			loggerHelper.error('Failed to get or create new conversation - ', e);
			throw e;
		}
	}

	async handleTwilioWebhookRequest(request: any): Promise<void> {
		try {
			if (request.EventType === 'onMessageAdded') {
				await this.onMessageAddedHandler(request);
			}
			winstonLogger.info(`Twilio webhook request handled successfully`);
		} catch (e) {
			loggerHelper.error('Failed to handle twilio webhook request - ', e);
			throw e;
		}
	}
	getMyBookingURL = (): string => {
		return `${process.env.SMS_BOOKING_URL}`;
	};
	getActivityURL = (): string => {
		return `${process.env.SMS_ACTIVITY_URL}`;
	};
	async sendBookingRequest(conversationSid: string, venueId: number, requestedByUser?: UserEntity){
		try {
			winstonLogger.info(`sendBookingRequest function started for conversationSid: ${conversationSid}, venueId: ${venueId}`);
			const InstBookableconversationRepository = MainDataSource.getRepository(InstantlyBookableConversationEntity);

			const existingConversation = await InstBookableconversationRepository.findOne({
				where: { conversationSid, isLocked: false },
				relations: ['participants'],
			});
			if (!existingConversation) throw new Error('Invalid conversationSid');

			const venueRepository = MainDataSource.getRepository(VenueEntity);

			const venue = await venueRepository.findOne({ where: { id: venueId } });

			const spaceRepository = MainDataSource.getRepository(SpaceEntity);

			const space = await spaceRepository.findOne({ where: { id: existingConversation.spaceId } });

			if (venue && space && requestedByUser) {
				if (
					(existingConversation.proxyNumber && existingConversation.participants.length === 2) ||
					existingConversation.participants.length === 2
				) {
					return { messageSid: '' };
				}

				await removeTwilioConversationParticipants(conversationSid);

				if (!existingConversation.proxyNumber) {
					const isPhoneNumberServiceEnabled = await this.features.isEnabled(FeatureFlag.isPhoneNumberServiceEnabled);
					if (isPhoneNumberServiceEnabled) {
						winstonLogger.info(`Phone number service enabled with API: ${PHONE_NUMBER_SERVICE_API}`);

						try {
							const numberFromPool = await this.getNumberFromPool();
							if (numberFromPool) {
								const { phoneNumberSid, phoneNumber } = numberFromPool;
								existingConversation.proxyNumber = Number(phoneNumber);
								existingConversation.proxyNumberSid = phoneNumberSid;
							} else {
								winstonLogger.info('Failed to get phone number from pool');
								const numberFromPool = await this.buyAndAddNumberToPool();
								if (numberFromPool) {
									const { phoneNumberSid, phoneNumber } = numberFromPool;
									existingConversation.proxyNumber = Number(phoneNumber);
									existingConversation.proxyNumberSid = phoneNumberSid;
								}
							}
						} catch (e) {
							winstonLogger.error(`Failed to get phone number from pool - ${e}`);
							const numberFromPool = await this.buyAndAddNumberToPool();
							if (numberFromPool) {
								const { phoneNumberSid, phoneNumber } = numberFromPool;
								existingConversation.proxyNumber = Number(phoneNumber);
								existingConversation.proxyNumberSid = phoneNumberSid;
							}
						}
					} else {
						winstonLogger.info('Phone number service not enabled, going to twilio');
						const twilioPhoneNumbers = await getTwilioPhoneNumbersForInstantBookble();
						const result = await purchaseTwilioPhoneNumberForInstantBooking(twilioPhoneNumbers[0].phoneNumber);
						loggerHelper.info(`Purchased number: ${result.twilioPhoneNumber}`);
						existingConversation.proxyNumber = Number(result.twilioPhoneNumber);
						existingConversation.proxyNumberSid = result.twilioPhoneNumberSid;
					}
					await InstBookableconversationRepository.save(existingConversation);
				}
				const chatParticipant2 = await addTwilioChatParticipant(conversationSid, 'Venue Manager');
				const chatVenueConversationParticipant = new InstantlyBookableParticipantEntity();
				chatVenueConversationParticipant.displayName = 'Venue Manager';
				chatVenueConversationParticipant.participantUserId = venue?.id;
				chatVenueConversationParticipant.participantSid = chatParticipant2.participantSid;
				chatVenueConversationParticipant.conversationId = existingConversation.id;
				chatVenueConversationParticipant.username = requestedByUser?.firstname + ' ' + requestedByUser?.lastname;

				const venueParticipant1 = await addTwilioSMSParticipant(
					conversationSid,
					`+${existingConversation.proxyNumber}`,
					true,
					venue.id,
					String(venue.phone)
				);
				const venueConversationParticipant1 = new InstantlyBookableParticipantEntity();
				if (venueParticipant1.participantSid != undefined) venueConversationParticipant1.participantSid = venueParticipant1.participantSid;
				venueConversationParticipant1.displayName = 'Venue Manager';
				venueConversationParticipant1.phoneNumber = venue.phone;
				venueConversationParticipant1.conversationId = existingConversation.id;
				venueConversationParticipant1.username = requestedByUser?.firstname + ' ' + requestedByUser?.lastname;

				existingConversation.participants = [chatVenueConversationParticipant, venueConversationParticipant1];
				await InstBookableconversationRepository.save(existingConversation);

			} else {
				throw new Error('Invalid venueId');
			}
		} catch (e) {
			loggerHelper.error('Failed to send message - ', e);
			throw e;
		}
	}

	async getBookingRequestStatus(params : any): Promise<InstantlyBookableStatus> {
		try {
			const invoiceRepository = MainDataSource.getRepository(InvoiceEntity);
			winstonLogger.info(`getBookingRequestStatus function started ${params}`);

			const invoiceData = await invoiceRepository.findOne({
				where: { spaceId: params.data.spaceId, createdById: params.data.userId, instantlyBookableRequested: true },
				order: { createdAt: 'DESC' },
			});
			
			winstonLogger.info(`getBookingRequestStatus invoiceData: ${invoiceData}`);
			if (!invoiceData) {
				return InstantlyBookableStatus.REQUESTBOOKING;
			} else if (invoiceData.instantlyBookableResponse === 'Y') {
				return InstantlyBookableStatus.BOOKSPACE;
			} else if (invoiceData.instantlyBookableResponse === 'N') {
				return InstantlyBookableStatus.DECLINED;
			} else if (invoiceData.instantlyBookReqAutoDecline === true) {
				return InstantlyBookableStatus.DECLINED;
			} else {
				return InstantlyBookableStatus.REQUESTED;
			}
		} catch (e) {
			loggerHelper.error('Failed to send message - ', e);
			throw e;
		}
	}



	private async onMessageAddedHandler(request: any): Promise<void> {
		const InstBookableconversationRepository = MainDataSource.getRepository(InstantlyBookableConversationEntity);
		winstonLogger.info(`onMessageAddedHandler function started for conversationSid: ${request.ConversationSid}`);
		const existingConversation = await InstBookableconversationRepository.findOne({
			where: { conversationSid: request.ConversationSid },
			relations: ['participants'],
		});
		winstonLogger.info(`onMessageAddedHandler existingConversation: ${existingConversation}`);

		const InvoiceRepository = MainDataSource.getRepository(InvoiceEntity);
		const invoiceData = await InvoiceRepository.findOne({
			where: {
				id: existingConversation?.invoiceId,
				userId: existingConversation?.userId,
				spaceId: existingConversation?.spaceId,
				instantlyBookableRequested: true,
				paid: false,
				instantlyBookableResponse: IsNull(),
			},
		});
		winstonLogger.info(`onMessageAddedHandler invoiceData: ${invoiceData}`);

		const venueData = await MainDataSource.getRepository(VenueEntity).findOneOrFail({
			where: { id: existingConversation?.venueId },
			relations: ['accessCustomData']
		});
		winstonLogger.info(`onMessageAddedHandler venueData: ${venueData}`);

		const userRepo = MainDataSource.getRepository(UserEntity);
		const userData = await userRepo.findOne({
			where: { id: invoiceData?.createdById },
		});
		winstonLogger.info(`onMessageAddedHandler userData: ${userData}`);

		const reservation = await MainDataSource.getRepository(ReservationEntity).findOneOrFail({
			where: { invoiceId:invoiceData?.id },
		});
		
		if (!existingConversation?.proxyNumber) throw new Error('Invalid conversationSid');
		if (
			existingConversation.participants.length === 2 &&
			venueData &&
			(request.Body.toUpperCase() === 'Y' || request.Body.toUpperCase() === 'N' || request.Body.toUpperCase() === 'YES' || request.Body.toUpperCase() === 'NO')
		) {
			console.log("Host Approval : existingConversation.participants.length"+ existingConversation.participants.length +",request Body"+ request.Body.toUpperCase() +",proxy"+ existingConversation?.proxyNumber)
			winstonLogger.info(`onMessageAddedHandler existingConversation.participants.length: ${existingConversation.participants.length}, request Body: ${request.Body.toUpperCase()}, proxy: ${existingConversation?.proxyNumber}`);
			if (existingConversation.isRequested && invoiceData && userData && reservation.status !== ReservationStatus.CANCELED
			) {
				existingConversation.isResponded = true;
				await InstBookableconversationRepository.save({
					...existingConversation,
					isResponded: true,
				});


				const isUSA = (reservation.tzUser || reservation.tzLocation).indexOf('America') !== -1;
		const timeFormat = isUSA ? 'hh:mm A' : 'HH:mm';

		const getReservTime = (time: string) =>
			dayjs(time)
				.tz(reservation.tzLocation)
				.format(`D MMMM YYYY ${timeFormat}`);

				const invoiceDatanew = invoiceData as any;

				invoiceDatanew.reservation = {
			hoursFrom: getReservTime(reservation.hoursFrom),
			hoursTo: reservation.hoursTo ? getReservTime(reservation.hoursTo) : 'In progress',
			bookedAt: dayjs(reservation.bookedAt)
				.tz(reservation.tzLocation)
				.format('ddd MMM D YYYY'),
			chargeType: reservation.chargeType,
			userTz: reservation.tzUser || reservation.tzLocation,
		};
		winstonLogger.info(`onMessageAddedHandler venue admin message initiated`);

				const venueAdminMessage = [
					`Thanks for your response!`,
					`\nFaster response times & up-to-date inventory help increase your visibility.`,
					`\n-DropDesk Spaces`,
				];

				const res = sendSMSInstantlyBookable(
					{
						to: String(request.Author),
						body: venueAdminMessage.join('\n'),
					},
					existingConversation.proxyNumber
				);
				winstonLogger.info(`onMessageAddedHandler venue admin message sent with response: ${res}`);

				let response = request.Body;
				if (request.Body.toUpperCase() === 'N' || request.Body.toUpperCase() === 'NO') {
					response = 'N';
				}
				else if (request.Body.toUpperCase() === 'Y' || request.Body.toUpperCase() === 'YES') {
					response = 'Y';
				}		
				winstonLogger.info(`onMessageAddedHandler response: ${response}`);

				invoiceData.instantlyBookableResponse = response;
				await InvoiceRepository.save({
					...invoiceData,
					instantlyBookableResponse: response,
				});
				if (existingConversation) this.sendSMS(response, venueData, existingConversation, invoiceDatanew, userData);
			}
		}
	}

	private async sendSMS(
		response: any,
		venueData: VenueEntity,
		existingConversation: InstantlyBookableConversationEntity,
		invoiceData: InvoiceEntity,
		userData: UserEntity
	) {
		winstonLogger.info(`sendSMS function started for response: ${response}, venueData: ${venueData}, existingConversation: ${existingConversation}, invoiceData: ${invoiceData}, userData: ${userData}`);

		const spaceinfo = await MainDataSource.getRepository(SpaceEntity).findOneOrFail({
			where: { id: invoiceData.spaceId},
		});

		const reservationTimeData = getReservationData(
			{
				existingConversation,
				venueData,
				invoice: invoiceData,
				space: spaceinfo,
			}
		)

		const customerMessageForN = [
			`Hi ${userData.username},`,
			`\nUnfortunately, ${venueData.name} cannot accomodate your booking - ${spaceinfo?.name} ${getReservationTimeString(reservationTimeData)}.`,
			`\nFeel free to select another time here: ${this.getMyBookingURL()}`,
			`\n-DropDesk Spaces`,
		];

		const customerMessageForY = [
			`Hi ${userData.username},`,
			`\n${venueData.name} has confirmed your booking - ${spaceinfo?.name} ${getReservationTimeString(reservationTimeData)}.`,
			`\nBooking Details: ${this.getMyBookingURL()}`,
			`\n-DropDesk Spaces`,
		];

		if (response === 'N') {
			if (existingConversation.proxyNumber) {
				const resForN = sendSMSInstantlyBookable(
					{
						to: String(userData.phone),
						body: customerMessageForN.join('\n'),
					},
					existingConversation.proxyNumber
				);
				winstonLogger.info(`sendSMS message to venue memeber for N: ${resForN}`);
				console.log("Host Approval : return the credit for N")

				await this.returnCreditforInstantlyBookableItem(
					invoiceData,
					userData
				);
			}
		} else if (response === 'Y') {
			if (existingConversation.proxyNumber) {
				const resForY = sendSMSInstantlyBookable(
					{
						to: String(userData.phone),
						body: customerMessageForY.join('\n'),
					},
					existingConversation.proxyNumber
				);
				winstonLogger.info(`sendSMS message to venue memeber for Y: ${resForY}`);
			}

			const inoicePaidStatus = await MainDataSource.getRepository(InvoiceStatusEntity).findOne({ where: { name: InvoiceStatus.PAID } });
			const securityDepositPaidStatus = await MainDataSource.getRepository(SecurityDepositStatusEntity).findOne({
				where: { name: InvoiceStatus.PAID },
			});

			if (inoicePaidStatus && securityDepositPaidStatus) {
				console.log("Host Approval : move to the payment for Y")
				await this.markAsPaidInstantlyBookableItem(
					invoiceData?.id,
					{
						statusId: inoicePaidStatus?.id,
						paymentModeId: 1, //for card
						securityDepositStatusId: securityDepositPaidStatus.id,
					},
					userData
				);
			}
		}
	}

	async markAsPaidInstantlyBookableItem(invoiceId: number, updateData: ChangeInvoiceStatusDto, requestedByUser: UserEntity) {
		const invoiceRepository = MainDataSource.getRepository(InvoiceEntity);
		const invoice = await invoiceRepository.findOneOrFail({
			where: { id: invoiceId },
			relations: [
				'issuedTo',
				'issuedTo.photo',
				'issuedTo.brand',
				'issuedTo.leadingTeams',
				'issuedTo.leadingTeams.subscriptions',
				'space',
				'space.amenities',
				'space.amenities.amenity',
				'space.photos',
				'space.packageBrands',
				'space.packageVenueTypes',
				'space.packageVenues',
				'space.packageSpaceTypes',
				'space.spaceType',
				'space.creditHours',
				'items',
				'venue',
				'venue.logo',
				'venue.photos',
				'venue.createdBy',
				'invoiceStatus',
				'reservation',
				'subscription',
				'paymentData',
			],
		});
		const { userId, space } = invoice;
		const newInvoiceStatus = await MainDataSource.getRepository(InvoiceStatusEntity).findOneOrFail({ where: { id: updateData.statusId } });
		const charged = await this.invoiceServices.processPayment(
			invoice,
			{
				endDate: '',
				startDate: '',
				userId: String(userId),
				takePayment: true,
			},
			requestedByUser,
			true
		);

		if (charged && space) await this.invoiceServices._deductSpaceQuantity(space);
		if (!charged) {
			throw new ForbiddenResponse({ message: 'Payment not charged.' });
		}
		invoice.invoiceStatus = (await this.invoiceServices._getStatusByName('New')) || undefined;
		if (invoice.space.chargeType !== ChargeType.MONTHLY) {
			invoice.invoiceStatus = newInvoiceStatus;
		}

		invoice.securityDepositStatusId = Number(updateData.securityDepositStatusId);
		invoice.securityDepositStatus = (await this.invoiceServices._getSecurityStatusByName('Paid')) || undefined;
		invoice.paymentMode = updateData.paymentModeId;
		invoice.paid = true;

		await invoiceRepository.save(invoice);

		console.log("Host Approval : payment completed for :" , invoice)

		return invoice;
	}

	async returnCreditforInstantlyBookableItem(invoiceData: InvoiceEntity, requestedByUser: UserEntity) {
		const invoiceRepository = MainDataSource.getRepository(InvoiceEntity);
		const reservationRepo = MainDataSource.getRepository(ReservationEntity);
		const invoice = await invoiceRepository.findOneOrFail({
			where: { id: invoiceData.id },
			relations: [
				'issuedTo',
				'issuedTo.leadingTeams',
				'issuedTo.leadingTeams.subscriptions',
				'space',
				'space.packageBrands',
				'space.packageVenueTypes',
				'space.packageVenues',
				'space.packageSpaceTypes',
				'space.spaceType',
				'space.creditHours',
				'items',
				'venue',
				'invoiceStatus',
				'reservation',
				'subscription',
			],
		});
		const { userId, space,subscriptionId } = invoice;
		invoice.invoiceStatus = await MainDataSource.getRepository(InvoiceStatusEntity).findOne({ where: { name: InvoiceStatus.DECLINED } }) || undefined;
		await invoiceRepository.save(invoice);	

		const reservation = await reservationRepo.findOneOrFail({
			where: { invoiceId:invoice.id },
		});

		reservation.status = ReservationStatus.CANCELED;
		await reservationRepo.save(reservation);

		if (subscriptionId) {
			const subService = new SubscriptionService();
			const creditHours = invoice.items.map((ii: InvoiceItemEntity) => ii.creditHours).reduce((a, b) => a + b, 0);
			await subService.changeCreditHours({
				type: (space.spaceType.logicType === SpaceTypeLogicType.MINUTELY ? 'check-in' : 'conference') as HoursType,
				rotationType: CreditRotationType.SPACE,
				hours: -creditHours,
				userId,
				createdById: requestedByUser.id,
				subscriptionId,
			});
			console.log("Host Approval : return credit for :" , invoice)
		}
	}

	async getNumberFromPool(): Promise<{ phoneNumberSid: string; phoneNumber: string } | undefined> {
		try {
			winstonLogger.info(`getNumberFromPool function started`);
			const {response} = await get({ apiName: 'phone_api_v2', path: '/a2p-phone-number' });

			return response?.then(async (response) => {
				winstonLogger.info(`Response from phoneNumberService call: ${JSON.stringify(response)}`);
				const data = await response.body.json();
				winstonLogger.info(`Data from phoneNumberService call: ${JSON.stringify(data)}`);
				const { phone_number_sid: phoneNumberSid, phone_number: phoneNumber } = data as { phone_number_sid: string; phone_number: string };
				winstonLogger.info(`phoneNumberSid: ${phoneNumberSid}`);
				winstonLogger.info(`phoneNumber: ${phoneNumber}`);
				return { phoneNumberSid, phoneNumber };
			}).catch((error: any) => {
				winstonLogger.error(`Error from phoneNumberService call: ${JSON.stringify(error)}`);
				console.log("Error from phoneNumberService call: ", error);
				return undefined;
			});
		} catch (error) {
			winstonLogger.error(`Error from phoneNumberService call: ${JSON.stringify(error)}`);
			return undefined;
		}
	}

	async buyAndAddNumberToPool(): Promise<{ phoneNumberSid: string; phoneNumber: string } | undefined > {
		try {
			winstonLogger.info(`buyAndAndNumberToPool function started`);

			const countryCode = "US";
			const limit = 1;
			const options = {
				headers: {
					'Content-Type': 'application/json',
				},
				body: { countryCode, limit },
			};
			winstonLogger.info(`options: ${JSON.stringify(options)}`);
			const { response } = await post({
				apiName: 'phone_api_v2',
				path: '/a2p-phone-number-pool',
				options: {
					headers: options.headers,
					body: options.body,
				}
			});
			return response.then(async(response: any) => {
				winstonLogger.info(`Response from phoneNumberPurchase call: ${JSON.stringify(response)}`);
				return (response as Response).json().then((data) => {
					winstonLogger.info(`Data from phoneNumberPurchase call: ${JSON.stringify(data)}`);
					const { phoneNumbers } = data as { phoneNumbers: { twilioPhoneNumberSid: string; twilioPhoneNumber: string }[] };
					if (phoneNumbers && phoneNumbers.length > 0) {
						const { twilioPhoneNumberSid: phoneNumberSid, twilioPhoneNumber: phoneNumber } = phoneNumbers[0];
						winstonLogger.info(`phoneNumberSid: ${phoneNumberSid}`);
						winstonLogger.info(`phoneNumber: ${phoneNumber}`);
						return { phoneNumberSid, phoneNumber };
					} else {
						winstonLogger.info("No phone numbers found in the response.");
						return undefined;
					}
				}).catch((error: any) => {
					winstonLogger.error(`Error from phoneNumberPurchase call: ${JSON.stringify(error)}`);
					return undefined;
				});
			});
		} catch (error) {
			winstonLogger.error(`Error from buyAndAndNumberToPool call: ${JSON.stringify(error)}`);
			return undefined;
		}
	}
}
