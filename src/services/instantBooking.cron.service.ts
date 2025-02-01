import dayjs from 'dayjs';
import loggerHelper, { cronLoggerHelper } from '@helpers/logger.helper';
import CronLogEntity, { CronLogStatus } from '@entity/cron-log.entity';
import MainDataSource from '@src/main-data-source';
import { Service } from 'typedi';
import InvoiceEntity from '@src/entity/invoice.entity';
import InstantlyBookableConversationEntity from '@src/entity/InstantlyBookable-conversation.entity';
import { sendSMSInstantlyBookable } from '@src/utils/helpers/twilio';
import InstantlyBookableParticipantEntity from '@src/entity/InstantlyBookable-participant.entity';
import VenueEntity from '@src/entity/venue.entity';
import { IsNull } from 'typeorm';
import UserEntity from '@src/entity/user.entity';
import { releaseTwilioPhoneNumberForInstantBooking, removeTwilioConversationParticipants } from '@src/utils/helpers/twilio-conversations.helper';
import InvoiceItemEntity from '@src/entity/invoice-item.entity';
import ReservationEntity from '@src/entity/reservation.entity';
import { getReservationData, getReservationTimeString } from '@src/utils/helpers/host-approval-sms.helper';
import SpaceEntity from '@src/entity/space.entity';
import InstantlyBookableConversationService from './instantlyBookableConversation.service';
import InvoiceService, { InvoiceEmailTypes } from './invoice.service';
import ReservationStatus from 'dd-common-blocks/dist/type/ReservationStatus';
import InvoiceStatusEntity from '@src/entity/invoice-status.entity';
import { InvoiceStatus } from '@src/utils/invoiceStatus';
import { patch } from 'aws-amplify/api';
import winstonLogger from '@src/utils/helpers/winston-logger';

@Service()
export default class InstantBookingCronService {
	/**
	 * Process spaces republish (1 min)
	 * @return {Promise<void>}
	 */
	async checkResponseForInstBookingRequest(): Promise<void> {
		const invoiceRepo = MainDataSource.getRepository(InvoiceEntity);

		const items = await invoiceRepo
			.createQueryBuilder('invoice')
			.distinctOn(['invoice.id'])
			.select([
				'invoice.id',
				'invoice.createdAt',
				'invoice.userId',
				'invoice.venueId',
				'invoice.spaceId',
				'invoice.instantlyBookableRequested',
				'invoice.instantlyBookableResponse',
				'invoice.reminderSend',
			])
			.where('invoice.reminderSend = false')
			.andWhere('invoice.instantlyBookReqAutoDecline IS NULL')
			.andWhere('invoice.instantlyBookableRequested = true')
			.andWhere('invoice.instantlyBookableResponse IS NULL')
			.getMany();

		await Promise.all(
			items.map(async (invoice: InvoiceEntity) => {
				if (dayjs().diff(dayjs(invoice.createdAt), 'minute') > 30) {
					if(!invoice.reminderSend)
					this.sendInstBookingReminder(invoice);
				}
			})
		);
	}

	async sendInstBookingReminder(data: InvoiceEntity): Promise<any> {
		try {
			const invoiceRepo = MainDataSource.getRepository(InvoiceEntity);

			const instBookableconversationRepository = MainDataSource.getRepository(InstantlyBookableConversationEntity);

			const InstBookableConvData = await instBookableconversationRepository.findOne({
				where: { userId: data.userId, spaceId: data.spaceId, isResponded: IsNull()},
			});

			const venueData = await MainDataSource.getRepository(VenueEntity).findOneOrFail({
				where: { id:data.venueId },
				relations: ['accessCustomData']
			});
	
			if (venueData && InstBookableConvData?.proxyNumber && !data.reminderSend) {

				const spaceData = await MainDataSource.getRepository(SpaceEntity).findOneOrFail({
					where: { id: data.spaceId},
				});
				
				const instBookableParticipantRepository = MainDataSource.getRepository(InstantlyBookableParticipantEntity);

				const InstBookableParticipantData = await instBookableParticipantRepository.findOne({
					where: { conversationId: InstBookableConvData.id },
				});

				const reservation = await MainDataSource.getRepository(ReservationEntity).findOneOrFail({
					where: { invoiceId:data.id },
				});
		
				data.reservation = reservation;		

				const reservationTimeData = getReservationData(
					{
						InstBookableConvData,
						venueData,
						invoice: data,
						space: spaceData,
					}
				)
				
				const instBookingReminder = [
					`Hi ${venueData.name},`,
					`\n\nPlease confirm whether you can accomodate ${InstBookableParticipantData?.username} booking - ${spaceData?.name}.`,
					`\nRequested to book your space on ${getReservationTimeString(reservationTimeData)}.`,
					`\n\nPlease reply “Y” for Yes or “N” for No to cancel this booking request.`,
					`\n\nBooking Details:  ${this.getMyBookingURL()}`,
					`\n\nFaster response times & up-to-date inventory help increase your visibility.`,
					`\n\n-DropDesk Spaces`,
				];

				const newData = await invoiceRepo.findOne({
					where: { id: data.id},
				});

				if(!newData?.reminderSend)
					{
						data.reminderSend = true;
						await invoiceRepo.save(data);
					return sendSMSInstantlyBookable(
					{ to: String(venueData.phone), body: instBookingReminder.join('\n') },
					InstBookableConvData.proxyNumber
				);	
			}		
			}
		} catch (e) {
			loggerHelper.error('Failed to send message - ', e);
			throw e;
		}
	}
	getMyBookingURL = (): string => {
		return `${process.env.SMS_BOOKING_URL}`;
	};

	/**
	 * Process spaces republish (1 min)
	 * @return {Promise<void>}
	 */
	async markAsAutoDeclineForInstBookingRequest(): Promise<void> {
		let query = MainDataSource.getRepository(InvoiceEntity)
			.createQueryBuilder('invoice')
			.distinctOn(['invoice.id'])
			.select([
				'invoice.id',
				'invoice.createdAt',
				'invoice.userId',
				'invoice.venueId',
				'invoice.spaceId',
				'invoice.instantlyBookableRequested',
				'invoice.instantlyBookableResponse',
				'invoice.reminderSend',
			])
			.leftJoinAndSelect('invoice.reservation', 'reservation')
			.addSelect('reservation')
			.where('invoice.instantlyBookableRequested = true')
			.andWhere('invoice.reminderSend = true')
			.andWhere('invoice.instantlyBookReqAutoDecline IS NULL')
			.andWhere('invoice.instantlyBookableResponse IS NULL')
			const items = await query.getMany();

		await Promise.all(
			items.map(async (invoice: InvoiceEntity) => {
				if (dayjs().diff(dayjs(invoice.createdAt), 'hour') > 24) {
					if(!invoice.instantlyBookReqAutoDecline)
					this.autoDeclineRequest(invoice, true);
				}
			})
		);
	}

	async autoDeclineRequest(data: InvoiceEntity, isfromCron : boolean): Promise<any> {
		try {
			const invoiceRepo = MainDataSource.getRepository(InvoiceEntity);

			const reservationRepo = MainDataSource.getRepository(ReservationEntity);

			const instBookableconversationRepository = MainDataSource.getRepository(InstantlyBookableConversationEntity);

			const instBookableconversation = await instBookableconversationRepository.findOne({
				where: { userId: data.userId, spaceId: data.spaceId, isResponded: IsNull() },
			});

			const userRepository = MainDataSource.getRepository(UserEntity);

			const userData = await userRepository.findOneOrFail({
				where: { id: data.userId},
			});

			const venueinfo = await MainDataSource.getRepository(VenueEntity).findOneOrFail({
				where: { id:data.venueId },
				relations: ['accessCustomData']
			});

			const invoiceItemRepository = MainDataSource.getRepository(InvoiceItemEntity);

			const invoiceItemData = await invoiceItemRepository.findOne({ where: { invoiceId: data.id } });

			if (venueinfo && invoiceItemData && instBookableconversation?.proxyNumber && !data.instantlyBookReqAutoDecline) {

				instBookableconversation.isResponded = true;
				await instBookableconversationRepository.save({
					...instBookableconversation,
					isResponded: true,
				});

				const service = new InstantlyBookableConversationService();

				service.returnCreditforInstantlyBookableItem(data, userData);

				const reservation = await reservationRepo.findOneOrFail({
					where: { invoiceId:data.id },
				});
		
				data.reservation = reservation;

				const spaceinfo = await MainDataSource.getRepository(SpaceEntity).findOneOrFail({
					where: { id: data.spaceId},
				});

				const reservationTimeData = getReservationData(
					{
						instBookableconversation,
						venueinfo,
						invoice: data,
						space: spaceinfo,
					}
				)

				const newData = await invoiceRepo.findOneOrFail({
					where: { id: data.id},
				});
				if(isfromCron)
					{
				const autoDeclineRequestContent = [
					`Hi ${userData?.username},`,
					`\n\nUnfortunately, ${venueinfo?.name} cannot accomodate your booking - ${spaceinfo?.name}. ${getReservationTimeString(reservationTimeData)}.`,
					`\n\nFeel free to select another time here:  ${this.getMyBookingURL()}`,
					`\n\n-DropDesk Spaces`,
				];
				data.invoiceStatus = await MainDataSource.getRepository(InvoiceStatusEntity).findOne({ where: { name: InvoiceStatus.DECLINED } }) || undefined;

				
				if(!newData?.instantlyBookReqAutoDecline)
					{
				 sendSMSInstantlyBookable(
					{
						to: String(userData?.phone),
						body: autoDeclineRequestContent.join('\n'),
					},
					instBookableconversation.proxyNumber
				);
			}
			}
			else
			{
				data.reservation.status = ReservationStatus.CANCELED;
				data.invoiceStatus = await MainDataSource.getRepository(InvoiceStatusEntity).findOne({ where: { name: InvoiceStatus.CANCELED } }) || undefined;
				await invoiceRepo.save(data);
				const invoiceService = new InvoiceService();
				await invoiceService._sendEmail(newData?.id, InvoiceEmailTypes.DEFAULT);
			}

				data.instantlyBookReqAutoDecline = true;
				
				reservation.status = ReservationStatus.CANCELED;
				await reservationRepo.save(reservation);

				const res = await invoiceRepo.save(data);
				return res;
			} 
		} catch (e) {
			loggerHelper.error('Failed to send message - ', e);
			throw e;
		}
	}

	/**
	 * Set isLocked to true for closed conversations
	 * @return {Promise<void>}
	 */
    async processLockInstBookConversations(isPhoneNumberServiceEnabled: boolean): Promise<void> {
        const instantlyBookconversationRepository = MainDataSource.getRepository(InstantlyBookableConversationEntity);
        const conversations = await instantlyBookconversationRepository
			.createQueryBuilder('InstantlyBookableConversation')
			.select(['InstantlyBookableConversation.id', 'InstantlyBookableConversation.isLocked', 'InstantlyBookableConversation.createdAt', 'InstantlyBookableConversation.conversationSid', 'InstantlyBookableConversation.proxyNumber', 'InstantlyBookableConversation.proxyNumberSid'])
			.where('InstantlyBookableConversation.isLocked = false')
			.getMany();

        await Promise.all(
            conversations.map(async (conversation:InstantlyBookableConversationEntity) => {
				if (dayjs().diff(dayjs(conversation.createdAt), 'hour') > 25 && dayjs().diff(dayjs(conversation.createdAt), 'hour') < 30) {
                try {
                    await removeTwilioConversationParticipants(conversation.conversationSid);
                    await this.writeLog({
                        method: 'processLockConversations',
                        status: CronLogStatus.SUCCESS,
                        message: `Removed participants of conversationSid ${conversation.conversationSid}.`,
                    });
					if (isPhoneNumberServiceEnabled) {
						if (conversation.proxyNumber) {
							winstonLogger.info("Releasing number to pool");
							await this.releaseNumberToPool(conversation.proxyNumberSid, conversation.proxyNumber.toString());
						}
					} else {
						winstonLogger.info("Releasing number to twilio");
                    	await releaseTwilioPhoneNumberForInstantBooking(conversation.proxyNumberSid);
					}
                    await this.writeLog({
                        method: 'processLockConversations',
                        status: CronLogStatus.SUCCESS,
                        message: `Released proxyNumber ${conversation.proxyNumber} with proxyNumberSid ${conversation.proxyNumberSid}.`,
                    });
                    await instantlyBookconversationRepository.save({ ...conversation, isLocked: true });
                    await this.writeLog({
                        method: 'processLockConversations',
                        status: CronLogStatus.SUCCESS,
                        message: `Locked conversation with ID ${conversation.id}.`,
                    });
                } catch (e) {
                    cronLoggerHelper.error(`ERROR in processLockConversations cycle (conversation ID: ${conversation.id})`, e);
                    await this.writeLog({
                        method: 'processLockConversations',
                        status: CronLogStatus.FAILED,
                        message: `Failed to updated isLocked column for instantBookableconversation with ID ${conversation.id}, (${(e as Error).message})`,
                        stack: (e as Error).stack,
                    });
                }  
			}   
            })
        );     
	}

	async writeLog({ method, status, message, stack }: { method: string; status: CronLogStatus; message: string; stack?: string }): Promise<void> {
		try {
			const repo = MainDataSource.getRepository(CronLogEntity);
			const logEntry: CronLogEntity = repo.create({ method, status, message, stack });
			await repo.save(logEntry);
		} catch (e) {
			cronLoggerHelper.error('ERROR writing log to db', e);
		}
	}

	async releaseNumberToPool(phoneNumberSid:string,phoneNumber:string): Promise<void> {
		try {
			winstonLogger.info("releaseNumberToPool function started");

			const options = {
				headers: {
					'Content-Type': 'application/json',
				},
				body: { "numberSid":phoneNumberSid, "number":phoneNumber },
			};
			winstonLogger.info(`releaseNumberToPool options: ${JSON.stringify(options)}`);
			const { response } = await patch({
				apiName: 'phone_api_v2',
				path: '/a2p-phone-number',
				options: {
					headers: options.headers,
					body: options.body,
				}
			});
			response.then((response) => {
				winstonLogger.info(`Response from releaseNumberToPool call: ${JSON.stringify(response)}`);
                response.body.json().then((data) => {
					winstonLogger.info(`Data from releaseNumberToPool call: ${JSON.stringify(data)}`);
				}).catch((error: any) => {
					winstonLogger.error(`Error from releaseNumberToPool call: ${JSON.stringify(error)}`);
				});
			});
		} catch (error) {
			winstonLogger.error(`Error from releaseNumberToPool call: ${JSON.stringify(error)}`);
		}	}
}
