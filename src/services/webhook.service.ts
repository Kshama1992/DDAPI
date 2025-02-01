import { webhookLoggerHelper } from '@helpers/logger.helper';
import { Inject, Service } from 'typedi';
import MainDataSource from '@src/main-data-source';
import UserEntity from '@entity/user.entity';
import SpaceProviderDataEntity from '@entity/space-provider-data.entity';
import PaymentProvider from 'dd-common-blocks/dist/type/PaymentProvider';
import SubscriptionService from '@services/subscription.service';
import SubscriptionProviderDataEntity from '@entity/subscription-provider-data.entity';
import InvoiceProviderDataEntity from '@entity/invoice-provider-data.entity';
import InvoiceService from '@services/invoice.service';
import InvoiceStatusService from '@services/invoice-status.service';
import InvoiceEntity from '@entity/invoice.entity';
import dayjs from 'dayjs';
import StripeService from '@services/stripe.service';
import PaymentDataEntity from '@entity/payment-data';
import { useStripe } from '@helpers/stripe.helper';
import InvoiceItemEntity from '@entity/invoice-item.entity';
import InvoiceItemType from 'dd-common-blocks/dist/type/InvoiceItemType';
import { Stripe } from 'stripe';
import { NODE_ENV } from '@src/config';
import { FeatureFlag } from '@src/utils/feature-flag';
import { Features } from '../utils/features';
import SecurityDepositService from './securitydeposit.refund.service';
@Service()
export default class WebhookService {
	@Inject()
	private subscriptionService: SubscriptionService;
	@Inject()
	private stripeService: StripeService;
	@Inject()
	private invoiceService: InvoiceService;
	@Inject()
	private securityDepositService: SecurityDepositService;
	@Inject()
	private invoiceStatusService: InvoiceStatusService;
	features: Features;

	private userRepo = MainDataSource.getRepository(UserEntity);
	private invoiceRepo = MainDataSource.getRepository(InvoiceEntity);
	private invoiceItemRepo = MainDataSource.getRepository(InvoiceItemEntity);
	private invoiceProviderDataRepo = MainDataSource.getRepository(InvoiceProviderDataEntity);
	private subscriptionProviderDataRepo = MainDataSource.getRepository(SubscriptionProviderDataEntity);

	constructor() {
		this.features = new Features();
	}

	async updateInvoiceProviderData({
		providerInvoiceNumber,
		providerInvoiceId,
		invoiceId,
	}: {
		providerInvoiceNumber: string | null;
		providerInvoiceId: string | undefined;
		invoiceId: number;
	}) {
		if (!providerInvoiceNumber) return;
		const providerData = await this.invoiceProviderDataRepo.find({ where: { providerInvoiceNumber } });
		const saveData: any = {
			providerInvoiceNumber,
			providerInvoiceId,
			provider: PaymentProvider.STRIPE,
			invoiceId,
		};
		if (providerData.length && providerData[0].providerInvoiceId) return;

		try {
			if (providerData.length) saveData.id = providerData[0].id;
			await this.invoiceProviderDataRepo.save(saveData);
		} catch (error) {
			webhookLoggerHelper.error(error);
		}
	}

	async updateSubscriptionProviderData({ providerSubscriptionId, subscriptionId }: { providerSubscriptionId: string; subscriptionId: number }) {
		const providerData = await this.subscriptionProviderDataRepo.find({ where: { providerSubscriptionId } });
		if (providerData.length) return;

		try {
			await this.subscriptionProviderDataRepo.save({
				providerSubscriptionId,
				provider: PaymentProvider.STRIPE,
				subscriptionId,
			});
		} catch (error) {
			webhookLoggerHelper.error(error);
		}
	}

	async updateAppInvoiceData({ invoiceObj }: { invoiceObj: Stripe.Invoice }) {
		const superAdminUser = await this.userRepo.findOneOrFail({ where: { username: 'Graham' } });
		let user = superAdminUser;
		const isstripeEnabledDynamic =  await this.features.isEnabled(FeatureFlag.isStripeWebhookDynamic)
		if(invoiceObj.customer_email && isstripeEnabledDynamic){
			user = await this.userRepo.findOneOrFail({ where: { email: invoiceObj.customer_email } })};
		const isSecurityDepositEnabled = await this.features.isEnabled(FeatureFlag.SecurityDeposit);
		const securityDepositCheck = 'Security Deposit';

		let appInvoiceObj: InvoiceEntity | undefined;

		let appUserId;

		if (invoiceObj.metadata && invoiceObj.metadata.invoiceId) {
			appUserId = Number(invoiceObj.metadata.userId);
			const appInvoiceObj1 = await this.invoiceRepo.findOne({ where: { id: Number(invoiceObj.metadata.invoiceId) } });

			if (appInvoiceObj1) appInvoiceObj = appInvoiceObj1;
		} else if (invoiceObj.subscription) {
			const stripeInvoiceSubscription = await this.stripeService.getSubscriptionById(invoiceObj.subscription as string, user?.id);
			// @ts-ignore
			if (!stripeInvoiceSubscription.metadata && !stripeInvoiceSubscription.metadata.invoiceId) return;

			if (
				stripeInvoiceSubscription.metadata &&
				stripeInvoiceSubscription.metadata.subscriptionId &&
				stripeInvoiceSubscription.metadata.env !== NODE_ENV
			)
				return;

			appUserId = Number(stripeInvoiceSubscription.metadata.userId);

			const subscriptionInvoices = await this.invoiceRepo.find({
				where: { subscriptionId: Number(stripeInvoiceSubscription.metadata.subscriptionId), paid: false },
				relations: ['items', 'invoiceStatus'],
			});

			const newInvoice = subscriptionInvoices.find((i) => i.invoiceStatus?.name === 'New');
			const upcomingInvoice = subscriptionInvoices.find((i) => i.invoiceStatus?.name === 'Upcoming');

			if (newInvoice) appInvoiceObj = newInvoice;
			else if (upcomingInvoice) appInvoiceObj = upcomingInvoice;
		} else return;

		await this.stripeService.checkInvoiceProductEnv({ invoice: invoiceObj });

		const invoiceUser = await this.userRepo.findOne({ where: { id: Number(appUserId) } });

		const updateData: Partial<InvoiceEntity> = {
			// @ts-ignore
			processDate: dayjs.unix(invoiceObj.date || invoiceObj.created).format(),
			subTotal: invoiceObj.subtotal / 100,
			paid: invoiceObj.paid,
			tax: Number(invoiceObj.tax) / 100,
		};

		if (appInvoiceObj)
			await this.updateInvoiceProviderData({
				providerInvoiceNumber: invoiceObj.number,
				providerInvoiceId: invoiceObj.id,
				invoiceId: appInvoiceObj.id,
			});

		const [invoiceStatusList] = await this.invoiceStatusService.list();
		const paidStatus = invoiceStatusList.find((is) => is.name === 'Paid');
		const upcomingStatus = invoiceStatusList.find((is) => is.name === 'Upcoming');

		if (appInvoiceObj && invoiceObj.paid) {
			updateData.invoiceStatusId = paidStatus.id;
			const spaceItem = appInvoiceObj.items?.find((i: InvoiceItemEntity) => i.invoiceItemType === InvoiceItemType.SPACE);
			await this.invoiceItemRepo.save({ ...spaceItem, price2: invoiceObj.subtotal / 100, price: invoiceObj.subtotal / 100, paid: true });

			updateData.paid = true;
			updateData.paidAmount = invoiceObj.amount_paid / 100;
			updateData.processDate = dayjs.unix(invoiceObj.created).format();

			const [stripe] = await useStripe(appUserId || superAdminUser.id);
			if (invoiceObj.charge) {
				const chargeResult = await stripe.charges.retrieve(invoiceObj.charge as string);

				updateData.processDate = dayjs.unix(invoiceObj.created).format();
				updateData.payDate = dayjs.unix(chargeResult.created).format();

				const payDataRepo = MainDataSource.getRepository(PaymentDataEntity);

				if(isSecurityDepositEnabled && invoiceObj?.metadata?.invoiceId)
				{
				const paymentDataDetails = await payDataRepo.findOne({ where: { invoiceId: Number(invoiceObj?.metadata?.invoiceId) } });

					if (paymentDataDetails === null) {
						const paymentDataRepo = MainDataSource.getRepository(PaymentDataEntity);
						const paymentData: PaymentDataEntity = paymentDataRepo.create();
						paymentData.provider = PaymentProvider.STRIPE;
						paymentData.paid = chargeResult.paid;
						paymentData.invoiceId = appInvoiceObj.id;
						paymentData.userId = appUserId || superAdminUser.id;
						if (isSecurityDepositEnabled && invoiceObj?.lines?.data[0]?.price?.nickname === securityDepositCheck) {
							paymentData.securityRefund = false;
							paymentData.securityDepositData = chargeResult;
							paymentData.securityAmount = Number(chargeResult.amount) / 100;
						} else {
							paymentData.refund = false;
							paymentData.data = chargeResult;
							paymentData.amount = Number(chargeResult.amount) / 100;
						}
						await paymentDataRepo.save(paymentData);
					} else {
						if (isSecurityDepositEnabled && invoiceObj?.lines?.data[0]?.price?.nickname === securityDepositCheck) {
							paymentDataDetails.securityRefund = false;
							paymentDataDetails.securityDepositData = chargeResult;
							paymentDataDetails.securityAmount = Number(chargeResult.amount) / 100;
						} else {
							paymentDataDetails.refund = false;
							paymentDataDetails.data = chargeResult;
							paymentDataDetails.amount = Number(chargeResult.amount) / 100;
						}
						await payDataRepo.update(paymentDataDetails?.id, paymentDataDetails);
					}
				} else {
					const paymentDataRepo = MainDataSource.getRepository(PaymentDataEntity);
					const paymentData: PaymentDataEntity = paymentDataRepo.create();
					paymentData.provider = PaymentProvider.STRIPE;
					paymentData.paid = chargeResult.paid;
					paymentData.invoiceId = appInvoiceObj.id;
					paymentData.userId = appUserId || superAdminUser.id;
					paymentData.refund = false;
					paymentData.data = chargeResult;
					paymentData.amount = Number(chargeResult.amount) / 100;
					await paymentDataRepo.save(paymentData);
				}
				// update payment intent status
				if (chargeResult.payment_intent)
					await stripe.paymentIntents.update(chargeResult.payment_intent as string, {
						description: `Invoice ${invoiceObj.number}`,
					});
			}
			console.log("inside webhook.service updateAppInvoiceData appInvoiceObj :"+appInvoiceObj+", invoiceObj.paid: "+ invoiceObj.paid  );	

			await this.invoiceService.update(appInvoiceObj.id, updateData, invoiceUser || superAdminUser, true, true);

			if (upcomingStatus && invoiceObj.subscription && appInvoiceObj?.subscriptionId) {
				// try to get upcoming invoice
				const stripeUpcomingInvoice = await stripe.invoices.retrieveUpcoming({ subscription: invoiceObj.subscription as string });
				const appUpcomingInvoice = await this.invoiceRepo.findOne({
					where: { subscriptionId: appInvoiceObj.subscriptionId, invoiceStatusId: upcomingStatus.id },
					relations: ['items'],
				});

				if (appUpcomingInvoice) {
					const upcomingUpdateData: Partial<InvoiceEntity> = {
						// @ts-ignore
						processDate: dayjs.unix(stripeUpcomingInvoice.next_payment_attempt || stripeUpcomingInvoice.created).format(),
						subTotal: stripeUpcomingInvoice.subtotal / 100,
						tax: Number(stripeUpcomingInvoice.tax) / 100,
					};

					await this.updateInvoiceProviderData({
						providerInvoiceNumber: stripeUpcomingInvoice.number,
						providerInvoiceId: stripeUpcomingInvoice.id,
						invoiceId: appUpcomingInvoice.id,
					});
					console.log("inside webhook.service updateAppInvoiceData appUpcomingInvoice :"+JSON.stringify(appUpcomingInvoice));	
					await this.invoiceService.update(appUpcomingInvoice.id, upcomingUpdateData, invoiceUser || superAdminUser, true, false);
				}
			}
		}

		if (appInvoiceObj) {
			if (!invoiceObj.subscription && isSecurityDepositEnabled) {
				console.log('inside webhook.service updateAppInvoiceData appInvoiceObj :' + JSON.stringify(appInvoiceObj));
				await this.invoiceService.update(appInvoiceObj.id, updateData, invoiceUser || superAdminUser, true, false);
			} else if (!isSecurityDepositEnabled) {
				console.log('inside webhook.service updateAppInvoiceData appInvoiceObj :' + JSON.stringify(appInvoiceObj));
				await this.invoiceService.update(appInvoiceObj.id, updateData, invoiceUser || superAdminUser, true, false);
			}
		}
	}

	async updatePaymentIntentData({ invoiceObj }: { invoiceObj: Stripe.PaymentIntent }) {
		const superAdminUser = await this.userRepo.findOneOrFail({ where: { username: 'Graham' } });
		let appuser = superAdminUser;
		const isstripeEnabledDynamic =  await this.features.isEnabled(FeatureFlag.isStripeWebhookDynamic)
	 if(invoiceObj?.customer && invoiceObj?.customer && isstripeEnabledDynamic){
		appuser = await this.userRepo.findOneOrFail({ where: { stripeCustomerId : String(invoiceObj.customer) } })};
		const isSecurityDepositEnabled = await this.features.isEnabled(FeatureFlag.SecurityDeposit);
		console.log('payment_intent : started processing for adding security amount for subscription :' + JSON.stringify(invoiceObj));

		if (invoiceObj.metadata.invoiceId && isSecurityDepositEnabled) {
			console.log('payment_intent : Check if payment intent of subscription having invoice id', invoiceObj.metadata.invoiceId);
			const payDataRepo = MainDataSource.getRepository(PaymentDataEntity);
			const paymentDataDetails = await payDataRepo.findOne({ where: { invoiceId: Number(invoiceObj.metadata.invoiceId) } });

			const stripeInvoiceSubscription = await this.stripeService.getChargeById(invoiceObj?.charges?.data[0].id as string, appuser.id);

			const appUserId = Number(stripeInvoiceSubscription.metadata.userId);

			const [stripe] = await useStripe(appUserId || superAdminUser.id);

			const charge = invoiceObj.charges ? await stripe.charges.retrieve(invoiceObj.charges.data[0].id) : {amount: 0};
			console.log('payment_intent : charge details for payment of invoice', charge.amount);

			try {
				if (paymentDataDetails != null) {
					paymentDataDetails.securityRefund = false;
					paymentDataDetails.securityDepositData = charge;
					paymentDataDetails.securityAmount = Number(charge.amount) / 100;
					await payDataRepo.save(paymentDataDetails);
					console.log('payment_intent : Invoice payment for security deposit', paymentDataDetails.id);
					return;
				}
			} catch (ex) {
				console.log('payment_intent : Error in saving details of payment intent', ex);
			}
		}
	}

	async updateRefundData({ charge }: { charge: Stripe.Charge }) {
		const superAdminUser = await this.userRepo.findOneOrFail({ where: { username: 'Graham' } });
		const stripeInvoiceId = charge.invoice as string;

		const [invoiceStatusList] = await this.invoiceStatusService.list();
		const refundStatus = invoiceStatusList.find((is) => is.includes('Refunded'));
		const providerData = await this.invoiceProviderDataRepo.findOneOrFail({
			where: { provider: PaymentProvider.STRIPE, providerInvoiceId: stripeInvoiceId },
		});
			console.log('inside webhook.service stripeHooks refundStatus: ' + JSON.stringify(refundStatus));
			if (charge?.refunds?.data[0]?.metadata?.reason) {
				await this.securityDepositService.update(
					providerData.invoiceId,
					{
						invoiceStatusId: refundStatus.id,
						refundNote: 'Refund from Stripe',
						refundAmount: charge.amount_refunded,
					},
					superAdminUser
				);
			} else {
				await this.invoiceService.update(
					providerData.invoiceId,
					{
						invoiceStatusId: refundStatus.id,
						refundNote: 'Refund from Stripe',
						refundAmount: charge.amount_refunded,
					},
					superAdminUser,
					true
				);
			}
		
	}

	async stripeHooks(event: Stripe.Event) {
		if (NODE_ENV === 'production' && !event.livemode) return;
		console.log("Stripe event triggered from webhook.service, event name: "+ event.type);
		console.log("Stripe event triggered from webhook.service, event request payload: "+ JSON.stringify(event) );

		const userRepo = MainDataSource.getRepository(UserEntity);
		// const invoiceRepo = MainDataSource.getRepository(InvoiceEntity);
		const spaceProviderDataRepo = MainDataSource.getRepository(SpaceProviderDataEntity);
		const invoiceProviderDataRepo = MainDataSource.getRepository(InvoiceProviderDataEntity);
		const subscriptionProviderDataRepo = MainDataSource.getRepository(SubscriptionProviderDataEntity);
		const superAdminUser = await userRepo.findOneOrFail({ where: { username: 'Graham' } });

		webhookLoggerHelper.info(event.type);
		console.log("Stripe event triggered from webhook.service, event request payload invoice data: "+ JSON.stringify(event.data.object) );
		// Handle the event
		switch (event.type) {
			case 'customer.deleted':
				try {
					console.log("inside: "+ event.type);
					const customer = event.data.object as Stripe.Customer;
					const user = await userRepo.findOneOrFail({ where: { stripeCustomerId: customer.id } });
					await userRepo.save({ ...user, stripeCustomerId: '' });
				} catch (e) {
					webhookLoggerHelper.error(e);
				}
				break;
			case 'customer.subscription.pending_update_expired':
			case 'customer.subscription.deleted':
				try {
					console.log("inside: "+ event.type);
					const subscription = event.data.object as Stripe.Subscription;

					if (subscription.metadata && subscription.metadata.subscriptionId && subscription.metadata.env !== NODE_ENV) return;

					const providerData = await subscriptionProviderDataRepo.findOneOrFail({
						where: { provider: PaymentProvider.STRIPE, providerSubscriptionId: subscription.id },
					});
					await this.subscriptionService.delete(providerData.subscriptionId);
				} catch (e) {
					webhookLoggerHelper.error(e);
				}
				break;
			case 'customer.subscription.created':
				try {
					console.log('inside: ' + event.type);
					const newSubscription = event.data.object as Stripe.Subscription;

					if (newSubscription.metadata && newSubscription.metadata.subscriptionId) {
						if (newSubscription.metadata.env !== NODE_ENV) return;
						await this.updateSubscriptionProviderData({
							providerSubscriptionId: newSubscription.id,
							subscriptionId: Number(newSubscription.metadata.subscriptionId),
						});

						if (await this.features.isEnabled(FeatureFlag.SecurityDeposit) && newSubscription.metadata.markAsPaid != "markAsPaid") {
							await this.stripeService.createPaymentIntentForSubscription({
								createdById: Number(newSubscription.metadata.createdByUserId.toString()),
								subscriptionId: Number(newSubscription.id),
								reservationId: Number(newSubscription.metadata.reservationId),
								spaceId: Number(newSubscription.metadata.spaceId),
								venueId: Number(newSubscription.metadata.venueId),
								userId: Number(newSubscription.metadata.userId),
								brandId: Number(newSubscription.metadata.brandId),
								invoiceId: Number(newSubscription.metadata.invoiceId),
								invoiceNumber: Number(newSubscription.metadata.invoiceNumber),
								teamId: Number(newSubscription.metadata.teamId),
								subscriptionResponse: newSubscription,
							});
						}
					}

					const subProviderData = await subscriptionProviderDataRepo.findOne({
						where: { provider: PaymentProvider.STRIPE, providerSubscriptionId: newSubscription.id },
					});

					// already in our db and we need to update billing date
					if (subProviderData) {
						const billingPeriodEnd = dayjs.unix(newSubscription.current_period_end).date();
						await this.subscriptionService.update(subProviderData.subscriptionId, { billCycleDate: billingPeriodEnd });
						return;
					}

					return;
				} catch (e) {
					webhookLoggerHelper.error(e);
				}
				break;
			// case 'invoice.created':
			case 'invoice.paid':
				try {
					console.log("inside: "+ event.type);
					const invoiceObj = event.data.object as Stripe.Invoice;
					await this.updateAppInvoiceData({ invoiceObj });
				} catch (e) {
					webhookLoggerHelper.error(e);
				}
				break;
			case 'payment_intent.succeeded':
				try {
					console.log('inside: ' + event.type);
					const invoiceObj = event.data.object as Stripe.PaymentIntent;
					await this.updatePaymentIntentData({ invoiceObj });
				} catch (e) {
					webhookLoggerHelper.error(e);
					console.log('payment_intent : Webhook error in saving details of payment intent',e, event.data.object);
				}
				break;
			case 'customer.subscription.updated':
				try {
					console.log("inside: "+ event.type);
					const updatedSubscription = event.data.object as Stripe.Subscription;

					if (updatedSubscription.metadata && updatedSubscription.metadata.subscriptionId && updatedSubscription.metadata.env !== NODE_ENV)
						return;

					const subProviderData = await subscriptionProviderDataRepo.findOne({
						where: { provider: PaymentProvider.STRIPE, providerSubscriptionId: updatedSubscription.id },
					});
					if (subProviderData) {
						const billingPeriodEnd = dayjs.unix(updatedSubscription.current_period_end).date();
						await this.subscriptionService.update(subProviderData.subscriptionId, { billCycleDate: billingPeriodEnd });
					}
				} catch (e) {
					webhookLoggerHelper.error(e);
				}
				break;
			case 'invoice.deleted':
				try {
					console.log("inside: "+ event.type);
					console.log("inside webhook.service stripeHooks ");
					const invoice = event.data.object as Stripe.Invoice;
					const [invoiceStatusList] = await this.invoiceStatusService.list();
					const voidStatus = invoiceStatusList.find((is) => is.name === 'Void');
					const providerData = await invoiceProviderDataRepo.findOneOrFail({
						where: { provider: PaymentProvider.STRIPE, providerInvoiceNumber: invoice.number as string },
					});
					await invoiceProviderDataRepo.remove(providerData);
					if (voidStatus){
						console.log("inside webhook.service stripeHooks voidStatus: "+JSON.stringify(voidStatus));
						await this.invoiceService.update(providerData.invoiceId, { invoiceStatusId: voidStatus.id }, superAdminUser, true);
					}
				} catch (e) {
					webhookLoggerHelper.error(e);
				}
				break;
			case 'invoice.voided':
				try {
					console.log("inside: "+ event.type);
					const invoice = event.data.object as Stripe.Invoice;
					const [invoiceStatusList] = await this.invoiceStatusService.list();
					const voidStatus = invoiceStatusList.find((is) => is.name === 'Void');
					const providerData = await invoiceProviderDataRepo.findOneOrFail({
						where: { provider: PaymentProvider.STRIPE, providerInvoiceNumber: invoice.number as string },
					});
					if (voidStatus){
						console.log("inside webhook.service stripeHooks voidStatus2: "+JSON.stringify(voidStatus));
						await this.invoiceService.update(providerData.invoiceId, { invoiceStatusId: voidStatus.id }, superAdminUser, true);
					}
				} catch (e) {
					webhookLoggerHelper.error(e);
				}
				break;
			case 'charge.refunded':
				try {
					console.log("inside: "+ event.type);
					const charge = event.data.object as Stripe.Charge;
					this.updateRefundData({charge})

				} catch (e) {
					webhookLoggerHelper.error(e);
				}
				break;
			case 'invoice.payment_failed':
				try {
					console.log("inside: "+ event.type);
					const [invoiceStatusList] = await this.invoiceStatusService.list();
					const paymentFailedStatus = invoiceStatusList.find((is) => is.name === 'Payment Failed');
					const invoice = event.data.object as Stripe.Invoice;
					const providerData = await invoiceProviderDataRepo.findOneOrFail({
						where: { provider: PaymentProvider.STRIPE, providerInvoiceId: invoice.id },
					});
					if (paymentFailedStatus){
						console.log("inside webhook.service stripeHooks paymentFailedStatus: "+JSON.stringify(paymentFailedStatus));
						await this.invoiceService.update(
							providerData.invoiceId,
							{
								invoiceStatusId: paymentFailedStatus.id,
								failureMessage: invoice.last_finalization_error ? invoice.last_finalization_error.message : '',
							},
							superAdminUser,
							true
						);
					}
				} catch (e) {
					webhookLoggerHelper.error(e);
				}
				break;
			case 'product.deleted':
				try {
					console.log("inside: "+ event.type);
					const product = event.data.object as Stripe.Product;
					const productRecord = await spaceProviderDataRepo.findOneOrFail({
						where: { provider: PaymentProvider.STRIPE, providerItemId: product.id },
					});
					await spaceProviderDataRepo.remove(productRecord);
				} catch (e) {
					webhookLoggerHelper.error(e);
				}
				break;
			default:
				webhookLoggerHelper.error(`Unhandled event type ${event.type}`);
		}
	}
}
