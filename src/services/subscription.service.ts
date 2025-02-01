import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import InvoiceStatusEntity from '@entity/invoice-status.entity';
import InvoiceEntity from '@entity/invoice.entity';
import loggerHelper from '@helpers/logger.helper';
import SubscriptionEntity from '@entity/subscription.entity';
import InvoiceService from '@services/invoice.service';
import SubscriptionCreditHoursEntity from '@entity/subscription-credit-hours.entity';
import SubscriptionCreditsRotationEntity from '@entity/subscription-credits-rotation.entity';
import CreditRotationType from 'dd-common-blocks/dist/type/CreditRotationType';
import BaseService from '@services/base.service';
import UserEntity from '@entity/user.entity';
import { ForbiddenResponse } from '@utils/response/forbidden.response';
import SubscriptionStatus from 'dd-common-blocks/dist/type/SubscriptionStatus';
import HoursType from 'dd-common-blocks/dist/type/HoursType';
import { Container, Inject, Service } from 'typedi';
import MainDataSource from '@src/main-data-source';
import { useStripe } from '@helpers/stripe.helper';
import SubscriptionProviderDataEntity from '@entity/subscription-provider-data.entity';
import StripeService from '@services/stripe.service';
import Stripe from 'stripe';
import SpaceProviderDataEntity from '@entity/space-provider-data.entity';
import UpdateSubscriptionDto from 'dd-common-blocks/dist/dto/update-subscription.dto';
import CreateInvoiceDto from '@src/dto/create-invoice.dto';
import ReservationEntity from '@entity/reservation.entity';
import { NODE_ENV } from '@src/config';

dayjs.extend(customParseFormat);

/**
 * Handle all actions with Subscriptions.
 * @module SubscriptionService
 * @category Services
 */
@Service()
export default class SubscriptionService extends BaseService {
	@Inject()
	stripeService: StripeService;

	private subscriptionRepo = MainDataSource.getRepository(SubscriptionEntity);
	private invoiceRepo = MainDataSource.getRepository(InvoiceEntity);
	private reservationRepo = MainDataSource.getRepository(ReservationEntity);
	private subscriptionCreditsRepo = MainDataSource.getRepository(SubscriptionCreditHoursEntity);
	private subscriptionCreditsRotationRepo = MainDataSource.getRepository(SubscriptionCreditsRotationEntity);
	private subscriptionProviderDataRepo = MainDataSource.getRepository(SubscriptionProviderDataEntity);

	constructor() {
		super();
		this.entity = SubscriptionEntity;
	}

	async single(id: number, requestedByUser?: UserEntity | undefined, options?: any): Promise<any> {
		const sub = await this.subscriptionRepo.findOneOrFail({
			where: { id },
			relations: [
				'brand',
				'space',
				'user',
				'creditHours',
				'creditsRotation',
				'providerData',
				'venue',
				'teams',
				'brands',
				'venues',
				'venueTypes',
				'spaceTypes',
				'subCategories',
			],
		});

		if (sub.providerData && sub.providerData.length && sub.providerData[0].providerSubscriptionId) {
			sub.providerSubscription = await this.stripeService.getSubscriptionById(sub.providerData[0].providerSubscriptionId, sub.userId);
		}
		return sub;
	}

	async list(options?: any, requestedByUser?: UserEntity | undefined): Promise<[any[], number]> {
		throw new ForbiddenResponse();
	}

	/**
	 * Delete subscription by id. Changes status for invoice and subscription to "deleted"
	 * @param {string} id - Subscription ID
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @param {boolean} isWebhook - Is request from webhook
	 * @returns {Promise<SubscriptionEntity>}
	 */
	async delete(id: number, requestedByUser?: UserEntity | undefined, isWebhook?: boolean): Promise<SubscriptionEntity | void> {
		const subItem = await this.subscriptionRepo.findOneOrFail({ where: { id } });

		if (subItem.status === SubscriptionStatus.CANCELED) return;
		// if (subItem.status === SubscriptionStatus.CANCELED) throw new ForbiddenResponse({ message: 'Already deleted' });

		const invoiceStatusList = await MainDataSource.getRepository(InvoiceStatusEntity).find();
		const upcomingStatus = await invoiceStatusList.find((is: InvoiceStatusEntity) => is.name === 'Upcoming');
		const voidStatus = await invoiceStatusList.find((is: InvoiceStatusEntity) => is.name === 'Void');

		if (upcomingStatus && voidStatus) {
			try {
				const invoice = await this.invoiceRepo.findOneOrFail({
					where: {
						subscriptionId: subItem.id,
						invoiceStatusId: upcomingStatus.id,
					},
				});
				await this.invoiceRepo.save({
					id: invoice.id,
					invoiceStatusId: voidStatus.id,
				});
			} catch (e) {
				loggerHelper.error('invoice status changing error - ', e);
			}
		}

		const providerSubData = await this.subscriptionProviderDataRepo.findOne({
			where: { subscriptionId: id },
		});

		if (providerSubData) {
			try {
				const providerSub = await this.stripeService.getSubscriptionById(providerSubData.providerSubscriptionId, subItem.userId);
				if (providerSub && providerSub.latest_invoice) {
					const latestProviderInvoice = await this.stripeService.getInvoiceById(providerSub.latest_invoice as string, subItem.userId);
					await this.subscriptionRepo.save({
						id: subItem.id,
						endDate: dayjs.unix(latestProviderInvoice.lines.data[0].period.end).toDate(),
						isOngoing: true,
						status: SubscriptionStatus.CANCELED,
					});
				}
				if (!isWebhook && requestedByUser) {
					await this.stripeService.deleteSubscription({
						providerSubscriptionId: providerSubData.providerSubscriptionId,
						userId: subItem.userId? subItem.userId : requestedByUser.id,
					});
				}
			} catch (e) {
				await this.subscriptionRepo.save({
					id: subItem.id,
					endDate: new Date(),
					isOngoing: false,
					status: SubscriptionStatus.CANCELED,
				});
			}
		} else {
			await this.subscriptionRepo.save({
				id: subItem.id,
				endDate: new Date(),
				isOngoing: false,
				status: SubscriptionStatus.CANCELED,
			});
		}

		return subItem;
	}

	/**
	 * Update subscription by ID
	 * @param {string} id - Subscription ID
	 * @param {UpdateSubscriptionDto} data - New (updated) subscription data
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<SubscriptionEntity>}
	 */
	async update(id: number, data: UpdateSubscriptionDto, requestedByUser?: UserEntity | undefined): Promise<SubscriptionEntity> {
		const cloneData = data;

		const subscription = await this.subscriptionRepo.findOneOrFail({ where: { id }, relations: ['creditHours', 'providerData', 'venue'] });

		if ([SubscriptionStatus.CANCELED, SubscriptionStatus.DELETED].includes(subscription.status))
			throw new ForbiddenResponse({ message: 'Cant update canceled subscription' });

		if (subscription.providerData && subscription.providerData.length) {
			const [stripe] = await useStripe(subscription.userId);

			const stripeUpdateData: Stripe.SubscriptionUpdateParams = {};

			if (data.endDate && dayjs(subscription.endDate).format() !== dayjs(data.endDate).format()) {
				stripeUpdateData.cancel_at = dayjs(data.endDate).utc().unix();
				const invoice = await this.invoiceRepo.findOne({ where: { subscriptionId: id } });
				if (invoice && invoice.reservationId) {
					await this.reservationRepo.update(invoice.reservationId, { hoursTo: dayjs(data.endDate).toString() });
				}
			}

			if (data.spaceAmount && subscription.spaceAmount !== data.spaceAmount) {
				const spaceProviderData = await MainDataSource.getRepository(SpaceProviderDataEntity).findOne({
					where: { spaceId: subscription.spaceId },
					order: { id: 'asc' },
				});

				if (spaceProviderData) {
					const stripeSubscriptionObj = await stripe.subscriptions.retrieve(subscription.providerData[0].providerSubscriptionId);
					stripeUpdateData.items = [
						{
							id: stripeSubscriptionObj.items.data[0].id,
							price_data: {
								currency: subscription.venue!.currency,
								product: spaceProviderData.providerItemId,
								unit_amount_decimal: String(data.spaceAmount * 100),
								recurring: { interval: 'month' },
							},
						},
					];
				}
			}

			if (data.resetBillAnchorToNow) {
				stripeUpdateData.billing_cycle_anchor = 'now';
				cloneData.billCycleDate = dayjs().date();
				subscription.billCycleDate = cloneData.billCycleDate;
			}

			await stripe.subscriptions.update(subscription.providerData[0].providerSubscriptionId, stripeUpdateData);
		}

		// TODO: delete. move creditRotationRecord to SubscriptionCreditHoursEntity subscriber
		if (cloneData.creditHours && cloneData.creditHours.length) {
			await Promise.all(
				cloneData.creditHours.map(async (acd) => {
					const clone = acd;

					// to number conversion
					clone.userId = subscription.userId;
					clone.given = Number(acd.given);
					clone.monthlyAmount = Number(acd.monthlyAmount);
					clone.used = Number(acd.used);

					if (acd.recurringMonth) clone.recurringMonth = Number(acd.recurringMonth);

					if (typeof clone.id !== 'undefined') {
						const previousValue = subscription.creditHours?.find((ch: SubscriptionCreditHoursEntity) => ch.id === clone.id);

						// Admin changed user credit hours
						if (JSON.stringify(previousValue) !== JSON.stringify(clone)) {
							await this.changeCreditHours({
								...clone,
								type: acd.type,
								rotationType: CreditRotationType.ADMIN,
								hours: acd.given ? +acd.given : 0,
								used: acd.used ? +acd.used : 0,
								userId: subscription.userId,
								createdById: requestedByUser ? requestedByUser.id : cloneData.updatedById,
								subscriptionId: subscription.id,
							});
						}
						console.log('clone id not null '+ String(clone));
					} else {
						console.log('clone id nul or undefined '+ String(clone));
						await this.subscriptionCreditsRepo.save(this.subscriptionCreditsRepo.create({ ...clone, subscriptionId: Number(id) }));
					}
				})
			);
		}
		delete cloneData.creditHours;
		delete subscription.creditHours;
		// delete cloneData.venueId;
		// delete cloneData.spaceId;

		// @ts-ignore
		await this.subscriptionRepo.save({ ...subscription, ...cloneData });

		if (
			subscription.providerData &&
			subscription.providerData.length &&
			cloneData.status &&
			cloneData.status !== subscription.status &&
			[SubscriptionStatus.DELETED, SubscriptionStatus.CANCELED].includes(cloneData.status)
		) {
			const providerSub = await this.subscriptionProviderDataRepo.findOne({
				where: { subscriptionId: id },
			});
			if (providerSub && requestedByUser) {
				const [stripe] = await useStripe(requestedByUser.id);
				await stripe.subscriptions.del(providerSub.providerSubscriptionId);
			}
		}
		return this.subscriptionRepo.findOneOrFail({
			where: { id: Number(id) },
			relations: {
				spaceTypes: true,
				venues: true,
				brands: true,
				space: true,
				venueTypes: true,
				creditHours: true,
				venue: true,
				subCategories:true,
			},
		});
	}

	async changeCreditHours({
		rotationType = CreditRotationType.SPACE,
		subscriptionId,
		type,
		hours,
		recurringForever,
		recurringMonth,
		used,
		notRecurring,
		rollover,
		userId,
		createdById,
		invoiceItemId,
	}: {
		rotationType?: CreditRotationType;
		type: HoursType;
		subscriptionId: number;
		hours: number; // hours to add reduce. if param "used" is present will be used as "given" param for credits
		recurringForever?: boolean | undefined;
		recurringMonth?: number | undefined;
		used?: number | undefined; // given hours. will replace also
		notRecurring?: boolean | undefined;
		rollover?: boolean | undefined;
		userId?: number | undefined;
		createdById?: number | undefined;
		invoiceItemId?: number | undefined;
	}) {
		try {
			const creditHours = await this.subscriptionCreditsRepo.findOneOrFail({ where: { subscriptionId, type } });

			if (typeof used !== 'undefined') {
				creditHours.used = +used;
				creditHours.given = +hours;
				console.log('type of used is not undefined '+ String(creditHours));
			} else {
				if (creditHours.given > hours) {
					creditHours.given -= hours;
					creditHours.used += hours;
					console.log('type of used undefined and creditHours.given > hours '+ String(creditHours));
				} else {
					console.log('type of used undefined and creditHours.given < hours '+ String(creditHours));
					creditHours.used += creditHours.given;
					creditHours.given = 0;
				}
			}

			await this.subscriptionCreditsRepo.save({
				...creditHours,
				recurringForever: typeof recurringForever !== undefined ? recurringForever : creditHours.recurringForever,
				notRecurring: typeof notRecurring !== undefined ? notRecurring : creditHours.notRecurring,
				rollover: typeof rollover !== undefined ? rollover : creditHours.rollover,
				recurringMonth: recurringMonth || creditHours.recurringMonth,
			});

			const newRecord = {
				userId: userId || creditHours.userId,
				createdById: createdById || creditHours.userId, // TODO: change to user that initiated this
				balance: creditHours.given,
				amount: hours,
				rotationType,
				type,
				subscriptionId,
				invoiceItemId,
			};
			console.log('subscriptionCreditsRotationRepo saving new record '+ String(creditHours));

			await this.subscriptionCreditsRotationRepo.save(this.subscriptionCreditsRotationRepo.create(newRecord));
		} catch (e) {
			loggerHelper.error(`Edit hours error!:`, e);
		}
	}

	/**
	 * Create new subscription
	 * @param {CreateInvoiceDto} data - New subscription data
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<void>}
	 */
	async create(data: CreateInvoiceDto, requestedByUser?: UserEntity | undefined): Promise<void> {
		const invoiceService = Container.get(InvoiceService);
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		return invoiceService.create(data, true, requestedByUser);
	}

	async deleteSubscriptionProviderData({ subscriptionId, userId }: { subscriptionId: number; userId: number }) {
		const providerSub = await this.subscriptionProviderDataRepo.findOne({
			where: { subscriptionId },
		});

		if (providerSub) {
			return await this.stripeService.deleteSubscription({ providerSubscriptionId: providerSub.providerSubscriptionId, userId });
		}
	}

	/**
	 * Process subscription credit hours
	 * @param subscriptionId
	 */
	async processRecurringCredits(subscriptionId: number, isMonthly : boolean,invoiceProcessDate :string|undefined): Promise<void> {
		const subscription = await this.subscriptionRepo.findOneOrFail({ relations: ['creditHours'], where: { id: subscriptionId } });
		const today = new Date();
		const dd = Number(String(today.getDate()).padStart(2, '0'));
		const processDate = invoiceProcessDate ?  (dayjs(invoiceProcessDate)).date() : 0;
		const isRenewal = (subscription.billCycleDate == dd ||subscription.billCycleDate == processDate) && isMonthly? true :false;
		console.log("inside processRecurringCredits  subscriptionId: "+ subscriptionId);
		if (subscription.creditHours)		
			await Promise.all(
				subscription.creditHours.map(async (ch) => {
					const newRecord = {
						userId: ch.userId,
						createdById: ch.userId,
						balance: 0,
						amount: 0,
						rotationType: CreditRotationType.CRON,
						type: ch.type,
						subscriptionId: subscription.id,
					};
					console.log("inside processRecurringCredits  subscription.creditHours "+ JSON.stringify(subscription.creditHours));
					console.log("inside processRecurringCredits ch object "+ JSON.stringify(ch));
					if (ch.notRecurring) {
						console.log("inside processRecurringCredits  ch.notRecurring1: "+ ch.notRecurring);
						if (ch.given === 0 && ch.used === 0) {
							console.log("inside processRecurringCredits ch.given==0 and ch.used==0");
							await this.subscriptionCreditsRepo.save({
								...ch,
								given: ch.monthlyAmount,
							});
							newRecord.balance = ch.monthlyAmount;
							newRecord.amount = ch.given + ch.monthlyAmount;
							await this.subscriptionCreditsRotationRepo.save(this.subscriptionCreditsRotationRepo.create(newRecord));
							console.log("inside processRecurringCredits saving the new record with details: "+JSON.stringify(newRecord));
							return;
						} else {
							console.log("inside processRecurringCredits ch.given not zer and ch.used not zero.. returning ch: "+JSON.stringify(ch));
							return ch;
						}
					}
					console.log("inside processRecurringCredits ch.notRecurring2: "+ ch.notRecurring+"else case not available");

					const months = Number(ch.recurringMonth);

					if (
						(months > 0 && dayjs(subscription.startDate).add(months, 'months').isBefore(dayjs().endOf('day'))) ||
						(months === 0 && ch.recurringForever)
					) {
						console.log("inside processRecurringCredits ch.recurringForever: "+ ch.recurringForever+", months"+months);						
						
					if(isRenewal)
						await this.subscriptionCreditsRepo.save({
							...ch,
							given: ch.monthlyAmount,
							used : 0
						});
						else{
							await this.subscriptionCreditsRepo.save({
								...ch
							});					}
						
							console.log("inside processRecurringCredits environment: "+ NODE_ENV);					
						
						newRecord.balance = ch.monthlyAmount;
						newRecord.amount = ch.monthlyAmount;
						await this.subscriptionCreditsRotationRepo.save(this.subscriptionCreditsRotationRepo.create(newRecord));
						return;
					}
					if (ch.rollover) {
						console.log("inside processRecurringCredits ch.rollover: "+ ch.rollover);
						await this.subscriptionCreditsRepo.save({
							...ch,
							given: ch.given + ch.monthlyAmount,
						});
						newRecord.balance = ch.monthlyAmount;
						newRecord.amount = ch.given + ch.monthlyAmount;
						await this.subscriptionCreditsRotationRepo.save(this.subscriptionCreditsRotationRepo.create(newRecord));
						return;
					}
					console.log("inside processRecurringCredits saved record: "+ JSON.stringify(newRecord));
				})
			);
	}
	
}
