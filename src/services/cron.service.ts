import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import dayjsutc from 'dayjs/plugin/utc';
import dayjstimezone from 'dayjs/plugin/timezone';
import isBetween from 'dayjs/plugin/isBetween';
import SubscriptionEntity from '@entity/subscription.entity';
import EntityStatus from 'dd-common-blocks/dist/type/EntityStatus';
import SpaceEntity from '@entity/space.entity';
import { cronLoggerHelper } from '@helpers/logger.helper';
import ReservationEntity from '@entity/reservation.entity';
import ConversationEntity from '@entity/conversation.entity';
import InvoiceService from '@services/invoice.service';
import SpaceStatus from 'dd-common-blocks/dist/type/SpaceStatus';
import CronLogEntity, { CronLogStatus } from '@entity/cron-log.entity';
import EventDataEntity from '@entity/event-data.entity';
import Socket from '@src/socket';
import SocketEventsType from 'dd-common-blocks/dist/type/SocketEventsType';
import ReservationStatus from 'dd-common-blocks/dist/type/ReservationStatus';
import SubscriptionStatus from 'dd-common-blocks/dist/type/SubscriptionStatus';
import { AUTO_CHECKOUT_DAYS, NODE_ENV } from '../config';
import MainDataSource from '@src/main-data-source';
import { Inject, Service } from 'typedi';
import SubscriptionService from '@services/subscription.service';
import { releaseTwilioPhoneNumber, removeTwilioConversationParticipants } from '@helpers/twilio-conversations.helper';

dayjs.extend(customParseFormat);
dayjs.extend(isSameOrAfter);
dayjs.extend(dayjsutc);
dayjs.extend(dayjstimezone);
dayjs.extend(isBetween);

@Service()
export default class CronService {
	@Inject()
	subscriptionService: SubscriptionService;

	subscriptionRepo = MainDataSource.getRepository(SubscriptionEntity);

	/**
	 * Process spaces republish (daily)
	 * @return {Promise<void>}
	 */
	async processSpacesRepublish(): Promise<void> {
		const spaceRepo = MainDataSource.getRepository(SpaceEntity);

		const items = await spaceRepo
			.createQueryBuilder('space')
			.select([
				'space.id',
				'space.usedQuantity',
				'space.quantity',
				'space.quantityRepublish',
				'space.quantityRepublishCustom',
				'space.lastUsed',
				'space.status',
			])
			.where('space.status = :status', { status: SpaceStatus.UNPUBLISED })
			.andWhere('space.quantityUnlimited = false')
			.andWhere('space.quantityRepublish > 0')
			.andWhere(
				'((extract(epoch from age(now(), "space"."lastUsed")) / 3600 > "space"."quantityRepublishCustom" AND "space"."quantityRepublish" = 777) or ("space"."quantityRepublish" != 777 and extract(epoch from age(now(), "lastUsed")) / 3600 > "quantityRepublish"))'
			)
			.getMany();

		await Promise.all(
			items.map(async (space: SpaceEntity) => {
				try {
					const clone = space;
					clone.lastUsed = new Date();
					clone.quantity = space.usedQuantity;
					clone.usedQuantity = 0;
					clone.status = SpaceStatus.PUBLISH;

					await MainDataSource.getRepository(SpaceEntity).save(clone);
					await this.writeLog({
						method: 'processSpacesRepublish',
						status: CronLogStatus.SUCCESS,
						message: `Space with ID ${space.id} republished.`,
					});
				} catch (e) {
					cronLoggerHelper.error(`ERROR in processSpacesRepublish`, e);
					await this.writeLog({
						method: 'processSpacesRepublish',
						status: CronLogStatus.FAILED,
						message: `Update space with ID ${space.id} failed, (${(e as Error).message})`,
						stack: (e as Error).stack,
					});
				}
			})
		);
	}



	/**
	 * Finish all drop-ins on space closed
	 * @return {Promise<void>}
	 */
	async processFinishDropIn(): Promise<void> {
		const repo = MainDataSource.getRepository(ReservationEntity);

		const activeDropIns = await repo
			.createQueryBuilder('Reservation')
			.leftJoinAndSelect('Reservation.reservedTo', 'reservedTo')
			.select([
				'Reservation.id',
				'Reservation.hoursFrom',
				'Reservation.tzUser',
				'Reservation.tzLocation',
				'Reservation.userId',
				'Reservation.spaceId',
				'reservedTo',
			])
			.andWhere('Reservation.isCheckin IS TRUE')
			.andWhere('Reservation.hoursTo IS NULL')
			.andWhere(`Reservation.hoursFrom + interval '${AUTO_CHECKOUT_DAYS} hours' <= NOW()`)
			.andWhere('Reservation.status = :status', { status: EntityStatus.ACTIVE })
			.getMany();

		await Promise.all(
			activeDropIns.map(async (reservation: ReservationEntity) => {
				try {
					const dropInStartTime = dayjs.tz(reservation.hoursFrom, reservation.tzUser?  reservation.tzUser : reservation.tzLocation);
					const finishTime = dropInStartTime.add(AUTO_CHECKOUT_DAYS, 'h');
					const invoiceService = new InvoiceService();
					await invoiceService.finishCheckIn(
						{
							reservationId: reservation.id,
							endTime: finishTime.format(),
						},
						reservation.reservedTo
					);

					if (NODE_ENV !== 'test')
						Socket.connection().sendEventToUser(String(reservation.userId), SocketEventsType.DROPIN_FINISH_CRON, {
							spaceId: reservation.spaceId,
							message: "You've been checked-out from space!",
						});

					await this.writeLog({
						method: 'processFinishDropIn',
						status: CronLogStatus.SUCCESS,
						message: `Reservation with ID ${reservation.id} finished.`,
					});
				} catch (e) {
					console.error(e);
					cronLoggerHelper.error(`ERROR in processFinishDropIn cycle (reservation ID: ${reservation.id})`, e);
					await this.writeLog({
						method: 'processFinishDropIn',
						status: CronLogStatus.FAILED,
						message: `Reservation with ID ${reservation.id} failed, (${(e as Error).message})`,
						stack: (e as Error).stack,
					});
				}
			})
		);
	}

	/**
	 * Unpublish passed events
	 * @return {Promise<void>}
	 */
	async processPassedEvents(): Promise<void> {
		const repo = MainDataSource.getRepository(EventDataEntity);
		const spaceRepo = MainDataSource.getRepository(SpaceEntity);

		const passedEvents = await repo
			.createQueryBuilder('EventData')
			.select(['EventData.id', 'EventData.spaceId'])
			.leftJoin('EventData.space', 'space')
			.andWhere('EventData.date < NOW()')
			.andWhere('space.status = :status', { status: SpaceStatus.PUBLISH })
			.getMany();

		await Promise.all(
			passedEvents.map(async (eventData: EventDataEntity) => {
				try {
					await spaceRepo.update(eventData.spaceId, { status: SpaceStatus.UNPUBLISED });
					await this.writeLog({
						method: 'processPassedEvents',
						status: CronLogStatus.SUCCESS,
						message: `Passed event with ID ${eventData.spaceId} unpublished.`,
					});
				} catch (e) {
					cronLoggerHelper.error(`ERROR in processPassedEvents cycle (space ID: ${eventData.spaceId})`, e);
					await this.writeLog({
						method: 'processPassedEvents',
						status: CronLogStatus.FAILED,
						message: `Passed event with ID ${eventData.spaceId} unpublishing failed, (${(e as Error).message})`,
						stack: (e as Error).stack,
					});
				}
			})
		);
	}

	/**
	 * Set status to finished for passed reservations
	 * @return {Promise<void>}
	 */
	async processPassedReservations(): Promise<void> {
		const repo = MainDataSource.getRepository(ReservationEntity);

		const passedReservations = await repo
			.createQueryBuilder('Reservation')
			.select(['Reservation.id', 'Reservation.status', 'Reservation.hoursTo'])
			.andWhere('Reservation.hoursTo < NOW()')
			.andWhere('Reservation.status = :status', { status: ReservationStatus.ACTIVE })
			.getMany();

		await Promise.all(
			passedReservations.map(async (reservation: ReservationEntity) => {
				try {
					await repo.save({ ...reservation, status: ReservationStatus.FINISHED });
					await this.writeLog({
						method: 'processPassedReservations',
						status: CronLogStatus.SUCCESS,
						message: `Passed reservation with ID ${reservation.id} unpublished.`,
					});
				} catch (e) {
					cronLoggerHelper.error(`ERROR in processPassedReservations cycle (reservation ID: ${reservation.id})`, e);
					await this.writeLog({
						method: 'processPassedReservations',
						status: CronLogStatus.FAILED,
						message: `Passed reservation with ID ${reservation.id} status change failed, (${(e as Error).message})`,
						stack: (e as Error).stack,
					});
				}
			})
		);
	}

	/**
	 * Update subscriptions if endDate is more than today
	 * @return {Promise<void>}
	 */
	async processUsersSubscriptions(): Promise<void> {
		try {
			const activeSubscriptions = await this.subscriptionRepo.find({
				relations: ['creditHours'],
				select: { id: true, endDate: true, startDate: true, creditHours: true },
				where: { isOngoing: true },
			});

			await Promise.all(
				activeSubscriptions.map(async (subscription) => {
					try {
						const endDate = dayjs(subscription.endDate);
						const subClone = subscription;

						if (dayjs().isAfter(endDate)) {
							cronLoggerHelper.info(`processUsersSubscriptions: Updating subscription with ID ${subClone.id}`);
							subClone.isOngoing = false;
							subClone.status = SubscriptionStatus.CANCELED;
							await this.subscriptionRepo.save(subClone);
							await this.writeLog({
								method: 'processUsersSubscriptions',
								status: CronLogStatus.SUCCESS,
								message: `Subscription with ID ${subscription.id} deactivated.`,
							});
						}
					} catch (e) {
						cronLoggerHelper.error(`ERROR in processUsersSubscriptions`, e);
						await this.writeLog({
							method: 'processFinishDropIn',
							status: CronLogStatus.FAILED,
							message: `Deactivation subscription with ID ${subscription.id} failed, (${(e as Error).message})`,
							stack: (e as Error).stack,
						});
					}
				})
			);
		} catch (e) {
			cronLoggerHelper.error('ERROR in processUsersSubscriptions', e);
			await this.writeLog({
				method: 'processUsersSubscriptions',
				status: CronLogStatus.FAILED,
				message: (e as Error).message,
				stack: (e as Error).stack,
			});
		}
	}

    /**
	 * Set isLocked to true for closed conversations
	 * @return {Promise<void>}
	 */
    async processLockConversations(): Promise<void> {
        const conversationRepository = MainDataSource.getRepository(ConversationEntity);
        const conversations = await conversationRepository
			.createQueryBuilder('Conversation')
			.select(['Conversation.id', 'Conversation.isLocked', 'Conversation.createdAt', 'Conversation.conversationSid', 'Conversation.proxyNumber', 'Conversation.proxyNumberSid'])
			.where('Conversation.isLocked = false')
			.andWhere('(CURRENT_DATE - "Conversation"."createdAt"::DATE) >= :noOfDays', { noOfDays: 21 })
			.getMany();

        await Promise.all(
            conversations.map(async (conversation:ConversationEntity) => {
                try {
                    await removeTwilioConversationParticipants(conversation.conversationSid);
                    await this.writeLog({
                        method: 'processLockConversations',
                        status: CronLogStatus.SUCCESS,
                        message: `Removed participants of conversationSid ${conversation.conversationSid}.`,
                    });
                    await releaseTwilioPhoneNumber(conversation.proxyNumberSid);
                    await this.writeLog({
                        method: 'processLockConversations',
                        status: CronLogStatus.SUCCESS,
                        message: `Released proxyNumber ${conversation.proxyNumber} with proxyNumberSid ${conversation.proxyNumberSid}.`,
                    });
                    await conversationRepository.save({ ...conversation, isLocked: true });
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
                        message: `Failed to updated isLocked column for conversation with ID ${conversation.id}, (${(e as Error).message})`,
                        stack: (e as Error).stack,
                    });
                }     
            })
        );     
    }

	async writeLog({
		method,
		status,
		message,
		stack,
	}: {
		method: string;
		status: CronLogStatus;
		message: string;
		stack?: string ;
	}): Promise<void> {
		try {
			const repo = MainDataSource.getRepository(CronLogEntity);
			const logEntry: CronLogEntity = repo.create({ method, status, message, stack });
			await repo.save(logEntry);
		} catch (e) {
			cronLoggerHelper.error('ERROR writing log to db', e);
		}
	}
}
