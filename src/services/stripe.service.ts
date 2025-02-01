import { DEFAULT_BRAND_ID, DOMAIN, NODE_ENV, PACIFIC_TZ, SERVER_URL, STRIPE_LIMIT_DELAY, STRIPE__SUBSCRIPTION_LIMIT_DELAY } from '../config';
import { Inject, Service } from 'typedi';
import MainDataSource from '../main-data-source';
import SpaceProviderDataEntity from '@entity/space-provider-data.entity';
import { useStripe } from '@helpers/stripe.helper';
import PaymentProvider from 'dd-common-blocks/dist/type/PaymentProvider';
import { getSpaceUrl } from '@utils/lib/space';
import SpaceEntity from '@entity/space.entity';
import ChargeType from 'dd-common-blocks/dist/type/ChargeType';
import dayjs, { extend } from 'dayjs';
import dayjsUtc from 'dayjs/plugin/utc';
import Stripe from 'stripe';
import loggerHelper from '@helpers/logger.helper';
import InvoiceStatusService from '@services/invoice-status.service';
import { ForbiddenResponse } from '@utils/response/forbidden.response';
import InvoiceEntity from '@entity/invoice.entity';
import SubscriptionEntity from '@entity/subscription.entity';
import delay from '@helpers/delay.helper';
import UserEntity from '@entity/user.entity';
import SpaceTypeLogicType from 'dd-common-blocks/dist/type/SpaceTypeLogicType';
import SpaceAmenityEntity from '@entity/space-amenity.entity';
import SpaceAmenityProviderDataEntity from '@entity/space-amenity-provider-data.entity';
import { FeatureFlag } from '@src/utils/feature-flag';
import { Features } from '../utils/features';
import { SecurityDeposit } from '@src/utils/constant';
import VenueEntity from '@src/entity/venue.entity';
import PackageShow from 'dd-common-blocks/dist/type/PackageShow';
import BrandEntity from '@src/entity/brand.entity';
import TeamMemberEntity from '@src/entity/team-member.entity';
import TeamEntity from '@src/entity/team.entity';

extend(dayjsUtc);
/**
 * Handle all actions with Stripe.
 * @module StripeService
 * @category Services
 */
@Service()
export default class StripeService {
	@Inject()
	invoiceStatusService: InvoiceStatusService;

	features: Features;

	private spaceRepo = MainDataSource.getRepository(SpaceEntity);
	private spaceAmenityRepo = MainDataSource.getRepository(SpaceAmenityEntity);
	private subscriptionRepo = MainDataSource.getRepository(SubscriptionEntity);
	private spaceProviderDataRepo = MainDataSource.getRepository(SpaceProviderDataEntity);
	private spaceAmenityProviderDataRepo = MainDataSource.getRepository(SpaceAmenityProviderDataEntity);

	/**
	 * Create subscription
	 * https://stripe.com/docs/api/subscriptions/create
	 * @param spaceId
	 * @param teamId
	 * @param invoiceId
	 * @param brandId
	 * @param venueId
	 * @param userId
	 * @param createdById
	 * @param subscriptionId
	 * @param reservationId
	 * @param invoiceNumber
	 * @param endDate - UTC timestamp
	 */

	constructor() {
        this.features = new Features();
    }

	async  processFromStripeDD(packageShow: PackageShow | undefined, venueBrandId: number | undefined , userId : number) {
		try{
				//below is the new logic added for TD-804 to enable booking other brand packages for Dropdesk users
		const isBookingFromOtherBrandEnabled =  await this.features.isEnabled(FeatureFlag.isBookingFromOtherBrandEnabled)
		if(isBookingFromOtherBrandEnabled)
		{	
		
		const dropDesk = await MainDataSource.getRepository(BrandEntity).findOneOrFail({
			where: { id:Number(DEFAULT_BRAND_ID) },
			select: {
				id: true,
				stripePublicKey: true,
				name: true,
			},
		});		
			
			const requestedByUser = await MainDataSource.getRepository(UserEntity).findOneOrFail({
				where: { id: userId }
			});		
			const userBrand = await MainDataSource.getRepository(BrandEntity).findOneOrFail({
				where: { id:Number(requestedByUser.brandId)  },
				select: {
					id: true,
					stripePublicKey: true,
					name: true,
				},
			});

			const venueBrand = await MainDataSource.getRepository(BrandEntity).findOneOrFail({
				where: { id:Number(venueBrandId)  },
				select: {
					id: true,
					stripePublicKey: true,
					name: true,
				},
			});
	
		if(packageShow===PackageShow.PUBLIC && venueBrandId != DEFAULT_BRAND_ID  && 
			(userBrand.stripePublicKey?.length ==0 || userBrand.stripePublicKey == null || userBrand.stripePublicKey == dropDesk.stripePublicKey)
			 && (venueBrand.stripePublicKey != null || venueBrand.stripePublicKey != '' ) && venueBrand.stripePublicKey != dropDesk.stripePublicKey) {
				return true;
			}
			else {
				return false;
			}
		}
		else {
			return false;
		}
	}
	catch(e){
		console.log('error in processFromStripeDD: ' + e);
	}
	}
	
	async createSubscription({
		spaceId,
		teamId,
		invoiceId,
		brandId,
		venueId,
		userId,
		createdById,
		subscriptionId,
		reservationId,
		invoiceNumber,
		endDate,
		markAsPaid
	}: {
		spaceId: number;
		teamId: number | undefined;
		invoiceId: number;
		brandId: number;
		venueId: number;
		userId: number;
		createdById: number;
		subscriptionId: number;
		reservationId: number | null;
		invoiceNumber: number;
		endDate: number;
		markAsPaid: string
	}): Promise<Stripe.Response<Stripe.Subscription> | undefined> {
		if (NODE_ENV === 'test') return;
		const spaceData = await this.spaceRepo.findOneOrFail({
			where: { id: spaceId },
			relations: ['venue', 'amenities', 'amenities.providerData'],
		});

		const subscriptionData = await this.subscriptionRepo.findOneOrFail({
			where: { id: subscriptionId },
		});

		const stripeProduct = await this.getProductBySpaceId(spaceId, userId);

		if (!stripeProduct || !stripeProduct.default_price) throw new Error('No default price!');

		const isProrate = [ChargeType.PRORATE, ChargeType.PRORATE_1].includes(spaceData.chargeType);

		const [stripe, stripeCustomerId] = await this.getStripe(spaceId, userId, false);

		const pad = '000000';
		const invoiceNumberString = pad.substring(0, pad.length - invoiceNumber.toString().length) + invoiceNumber.toString();

		let billCycleDate = dayjs().date(subscriptionData.billCycleDate);
		if (dayjs().isAfter(billCycleDate)) billCycleDate = billCycleDate.add(1, 'month');
		if (billCycleDate.isSame(dayjs(), 'day')) billCycleDate = billCycleDate.add(1, 'minute');

		const amenitiesData = spaceData.amenities
			? await Promise.all(
					spaceData.amenities.map(async (amenity) => {
						const stripeAmenityProduct = await this.getProductBySpaceAmenityId(spaceId, amenity.id, userId);
						if (!stripeAmenityProduct || !stripeAmenityProduct.default_price) throw new Error('No default price!');
						return stripeAmenityProduct.default_price as string;
					})
			  )
			: [];
			
		const stripeSubData: Stripe.SubscriptionCreateParams = {
			customer: stripeCustomerId,
			cancel_at: endDate,
			currency: spaceData.venue.currency,
			billing_cycle_anchor: isProrate ? billCycleDate.tz(PACIFIC_TZ).unix() : undefined,
			proration_behavior: isProrate ? 'create_prorations' : 'none',
			description:
				NODE_ENV === 'production'
					? `Subscription by invoice #${invoiceNumberString}`
					: `${NODE_ENV.toUpperCase()} Subscription by invoice #${invoiceNumberString}`,
			items: [
				{ price: stripeProduct.default_price as string },
				...amenitiesData.map((aId) => ({ price: aId })),
			],
			metadata: {
				subscriptionId,
				createdByUserId: createdById,
				reservationId,
				spaceId,
				venueId,
				userId,
				brandId,
				teamId: String(teamId),
				env: NODE_ENV,
				serverUrl: SERVER_URL,
				invoiceId,
				invoiceNumber: invoiceNumber,
				markAsPaid : markAsPaid
			},
		};

		if (ChargeType.PRORATE_1 === spaceData.chargeType) {
			stripeSubData.add_invoice_items = [
				{
					price_data: {
						currency: spaceData.venue.currency,
						unit_amount_decimal: String(spaceData.price * 100),
						product: stripeProduct.id,
					},
					quantity: 1,
				},
			];
		}


		try {
			return await stripe.subscriptions.create(stripeSubData);
			} catch (e) {
			await MainDataSource.getRepository(SubscriptionEntity).delete(subscriptionId);
			throw e;
		}
	}

	async createPaymentIntentForSubscription({
		spaceId,
		teamId,
		invoiceId,
		brandId,
		venueId,
		userId,
		createdById,
		subscriptionId,
		reservationId,
		invoiceNumber,
		subscriptionResponse
	}: {
		spaceId: number;
		teamId: number | undefined;
		invoiceId: number;
		brandId: number;
		venueId: number;
		userId: number;
		createdById: number;
		subscriptionId: number;
		reservationId: number | null;
		invoiceNumber: number;
		subscriptionResponse : Stripe.Subscription
	}): Promise<Stripe.Response<Stripe.Subscription> | undefined> {
		if (NODE_ENV === 'test') return;
		const spaceData = await this.spaceRepo.findOneOrFail({
			where: { id: spaceId },
			relations: ['venue', 'amenities', 'amenities.providerData'],
		});

		const stripeProduct = await this.getProductBySpaceId(spaceId, userId);

		const securityDepositCheck = 'Security Deposit';

		if (!stripeProduct || !stripeProduct.default_price) throw new Error('No default price!');

		const [stripe] = await this.getStripe(spaceId,userId,false);

		const priceList = await stripe.prices.list({
			product: stripeProduct.id,
		});

		const securityDepositPrice = priceList.data.find((price) => price.nickname === securityDepositCheck);

		try {
			if (securityDepositPrice && securityDepositPrice.unit_amount !== 0) {
				const customer: Stripe.Customer = (await stripe.customers.retrieve(subscriptionResponse.customer.toString())) as Stripe.Customer;
				await delay(STRIPE__SUBSCRIPTION_LIMIT_DELAY);
				 await stripe.paymentIntents.create({
					amount: Math.round(Number(securityDepositPrice.unit_amount)), 
					currency: spaceData.venue.currency,
					confirm: true,
					customer: subscriptionResponse.customer.toString(),
					payment_method: String(customer.default_source),
					metadata: {
						subscriptionId,
						createdByUserId: createdById,
						reservationId,
						spaceId,
						venueId,
						userId,
						brandId,
						teamId: String(teamId),
						env: NODE_ENV,
						serverUrl: SERVER_URL,
						invoiceId,
						invoiceNumber: invoiceNumber
					},
				  });

			}
		} catch (e) {
			throw e;
		}
	}

	/**
	 * Cancel subscription
	 * https://stripe.com/docs/api/subscriptions/cancel
	 * @param providerSubscriptionId
	 * @param userId
	 */
	async deleteSubscription({
		providerSubscriptionId,
		userId,
	}: {
		providerSubscriptionId: string;
		userId: number;
	}): Promise<Stripe.Response<Stripe.Subscription> | undefined> {
		if (NODE_ENV === 'test') return;
		try {
			const [stripe] = await this.getStripe(0,userId,false);
			const providerSubscription = await stripe.subscriptions.retrieve(providerSubscriptionId);
			if (providerSubscription && providerSubscription.latest_invoice) {
				return await stripe.subscriptions.update(providerSubscriptionId, { cancel_at_period_end: true });
			}
			return stripe.subscriptions.del(providerSubscriptionId);
		} catch (e) {
			loggerHelper.error(e);
			return;
		}
	}

	/**
	 * Update subscription
	 * https://stripe.com/docs/api/subscriptions/update
	 * @param providerSubscriptionId
	 * @param billCycleDate
	 * @param endDate
	 * @param userId
	 */
	async updateSubscription({
		providerSubscriptionId,
		billCycleDate,
		endDate,
		userId,
	}: {
		providerSubscriptionId: string;
		billCycleDate?: number;
		userId: number;
		endDate?: any;
	}): Promise<Stripe.Response<Stripe.Subscription> | undefined> {
		if (NODE_ENV === 'test') return;
		try {
			if (!endDate && !billCycleDate) return;
			const updateData: Stripe.SubscriptionUpdateParams = {};

			// if (billCycleDate) {
			// 	let billCycleDateDJS = dayjs().date(billCycleDate);
			// 	if (dayjs().isAfter(billCycleDateDJS)) billCycleDateDJS = billCycleDateDJS.add(1, 'month');
			// 	if (billCycleDateDJS.isSame(dayjs(), 'day')) billCycleDateDJS = billCycleDateDJS.add(1, 'minute');
			// 	updateData.billing_cycle_anchor = billCycleDateDJS.unix();
			// }

			if (endDate) {
				updateData.cancel_at = dayjs(endDate).utc().unix();
			}
			const [stripe] = await this.getStripe(0,userId,false);
			// const updateData: Stripe.SubscriptionUpdateParams = {
			// 	cancel_at: endDate,
			// 	billing_cycle_anchor: billCycleDateDJS.unix(),
			// };
			return stripe.subscriptions.update(providerSubscriptionId, updateData);
		} catch (e) {
			loggerHelper.error(e);
			return;
		}
	}

	/**
	 * Create price for product
	 * https://stripe.com/docs/api/prices/create
	 * @param userId
	 * @param spaceId
	 * @param updatedById
	 * @param createdById
	 * @param stripeProductId
	 * @param price
	 * @param currency
	 */
	async createSpacePrice({
		userId,
		spaceId,
		updatedById,
		createdById,
		stripeProductId,
		price,
		securityDepositPrice,
		currency,
	}: {
		currency: string;
		price: number;
		securityDepositPrice : number;
		createdById: number;
		updatedById?: number;
		userId: number;
		spaceId: number;
		stripeProductId: string;
	}): Promise<Stripe.Response<Stripe.Price> | void> {
		if (NODE_ENV === 'test') return;
		const space = await this.spaceRepo.findOne({ where: { id: spaceId }, relations: ['spaceType'] });

		if (space?.spaceType.logicType === SpaceTypeLogicType.INFO) return;

		const [stripeUser] = await useStripe(userId); 
		const [stripe] = await this.getStripe(spaceId,userId,true);
		const metadata = {
			createdByUserId: createdById,
			updatedByUserId: updatedById || null,
			spaceId,
			env: NODE_ENV,
			serverUrl: SERVER_URL,
		};

		const priceObj: Stripe.PriceCreateParams = {
			currency: currency.toLowerCase(),
			unit_amount_decimal: String(price * 100),
			product: stripeProductId,
			metadata,
		};

		const securityPriceObj: Stripe.PriceCreateParams = {
			nickname: 'Security Deposit',
			currency: currency.toLowerCase(),
			unit_amount_decimal: String(securityDepositPrice * 100),
			product: stripeProductId,
			metadata,
		};

		if (
			space &&
			([ChargeType.PRORATE_1, ChargeType.PRORATE, ChargeType.MONTHLY].includes(space.chargeType) ||
				(space.chargeType === ChargeType.FREE && [SpaceTypeLogicType.MONTHLY].includes(space.spaceType.logicType)))
		) {
			priceObj.recurring = { interval: 'month' };
		}

		const newPrice = await stripe.prices.create(priceObj);
		let newPriceDD = null;
			//below is the new logic added for TD-804 to enable booking other brand packages for Dropdesk users
		if(await this.processFromStripeDD(space?.packageShow, space?.venue?.brandId, userId)){
			newPriceDD = await stripeUser.prices.create(priceObj);
		}
		
		if(await this.features.isEnabled(FeatureFlag.SecurityDeposit))
		{
			const securityPrice = await stripe.prices.list({
				product: stripeProductId,
			});
			const securityDepositPrice = securityPrice.data.find((price) => price.nickname === SecurityDeposit);
			if(securityDepositPrice)
			{
				const updateSecurityPriceObj: Stripe.PriceUpdateParams = {
					active: false,
					metadata,
				};
			await stripe.prices.update(securityDepositPrice.id as string,updateSecurityPriceObj);
				//below is the new logic added for TD-804 to enable booking other brand packages for Dropdesk users
			if( await this.processFromStripeDD(space?.packageShow, space?.venue?.brandId, userId))
			await stripeUser.prices.update(securityDepositPrice.id as string,updateSecurityPriceObj);
			console.log('Set as old price inactive', { stripeProductId, data: userId, updateSecurityPriceObj });
			}
			await stripe.prices.create(securityPriceObj);
				//below is the new logic added for TD-804 to enable booking other brand packages for Dropdesk users
			if(await this.processFromStripeDD(space?.packageShow, space?.venue?.brandId, userId)){
				await stripeUser.prices.create(securityPriceObj);
			}
			
			console.log('Create new price', { stripeProductId, data: userId, securityPriceObj });

		}

		await stripe.products.update(stripeProductId, {
			default_price: newPrice.id,
		});
			//below is the new logic added for TD-804 to enable booking other brand packages for Dropdesk users
		if(await this.processFromStripeDD (space?.packageShow, space?.venue?.brandId, userId))
		await stripeUser.products.update(stripeProductId, {
			default_price: newPriceDD?.id,
		});
		await this.spaceProviderDataRepo.save(
			this.spaceProviderDataRepo.create({
				provider: PaymentProvider.STRIPE,
				providerItemId: stripeProductId,
				providerItemPriceId: newPrice.id,
				providerItemPriceIdDD: newPriceDD?.id,
				spaceId,
			})
		);

		/**
		 * Stripe limits
		 * @link https://stripe.com/docs/rate-limits
		 */
		await delay(STRIPE_LIMIT_DELAY);

		return newPrice;
	}

	/**
	 * Create space amenity price for product
	 * https://stripe.com/docs/api/prices/create
	 * @param userId
	 * @param spaceAmenityId
	 * @param updatedById
	 * @param createdById
	 * @param stripeProductId
	 * @param price
	 */
	async createSpaceAmenityPrice({
		userId,
		spaceAmenityId,
		updatedById,
		createdById,
		stripeProductId,
		price,
	}: {
		price: number;
		createdById: number;
		updatedById?: number;
		userId: number;
		spaceAmenityId: number;
		stripeProductId: string;
	}): Promise<Stripe.Response<Stripe.Price> | void> {
		if (NODE_ENV === 'test') return;

		const spaceAmenity = await this.spaceAmenityRepo.findOne({
			where: { id: spaceAmenityId },
			relations: ['space', 'space.venue', 'space.spaceType'],
		});

		if (!spaceAmenity) return;

		if (spaceAmenity.space?.spaceType.logicType === SpaceTypeLogicType.INFO) return;
		
		const [stripe] = await this.getStripe(0,userId,true);
		const [stripeUser] = await useStripe(userId);
		const metadata = {
			createdByUserId: createdById,
			updatedByUserId: updatedById || null,
			spaceAmenityId,
			env: NODE_ENV,
			serverUrl: SERVER_URL,
		};

		const priceObj: Stripe.PriceCreateParams = {
			currency: spaceAmenity.space!.venue!.currency.toLowerCase(),
			unit_amount_decimal: String(price * 100),
			product: stripeProductId,
			metadata,
		};

		if (
			spaceAmenity.space &&
			([ChargeType.PRORATE_1, ChargeType.PRORATE, ChargeType.MONTHLY].includes(spaceAmenity.space.chargeType) ||
				(spaceAmenity.space.chargeType === ChargeType.FREE && [SpaceTypeLogicType.MONTHLY].includes(spaceAmenity.space.spaceType.logicType)))
		) {
			priceObj.recurring = { interval: 'month' };
		}

		const newPrice = await stripe.prices.create(priceObj);
		let newPriceDD = null;
		await stripe.products.update(stripeProductId, { default_price: newPrice.id });
		if(spaceAmenity.space?.packageShow ===PackageShow.PUBLIC && spaceAmenity.space.venue.brandId != DEFAULT_BRAND_ID){
			newPriceDD = await stripeUser.prices.create(priceObj);
			await stripeUser.products.update(stripeProductId, { default_price: newPriceDD.id });
		}
		

		await this.spaceAmenityProviderDataRepo.save(
			this.spaceAmenityProviderDataRepo.create({
				provider: PaymentProvider.STRIPE,
				providerItemId: stripeProductId,
				providerItemPriceId: newPrice.id,
				providerItemPriceIdDD: newPrice?.id,
				spaceAmenityId,
			})
		);
		return newPrice;
	}

	/**
	 * Create Stripe product
	 * https://stripe.com/docs/api/products/create
	 * @todo refactor me
	 * @param userId
	 * @param spaceId
	 * @param createdById
	 * @param space
	 */
	async createSpaceProduct({
		userId,
		spaceId,
		createdById,
	}: {
		createdById: number;
		userId: number;
		spaceId: number;
	}): Promise<Stripe.Response<Stripe.Product> | undefined> {
		if (NODE_ENV === 'test') return;

		const space = await this.spaceRepo
			.createQueryBuilder('s')
			.leftJoinAndSelect('s.venue', 'venue')
			.leftJoinAndSelect('s.spaceType', 'spaceType')
			.leftJoinAndSelect('s.photos', 'photos')
			.leftJoinAndSelect('s.providerData', 'providerData')
			.leftJoinAndSelect('venue.photos', 'venuePhotos')
			.leftJoinAndSelect('venue.brand', 'brand')
			.where('s.id = :spaceId', { spaceId })
			.select([
				's.name',
				's.alias',
				's.description',
				's.price',
				's.securityDepositPrice',				
				'photos',
				's.chargeType',
				's.packageShow',
				'venue.id',
				'venue.alias',
				'venue.currency',
				'venue.country',
				'venue.city',
				'venue.brandId',
				'venue.brand',
				'venue.state',
				'venuePhotos',
				'spaceType',
			])
			.getOneOrFail();
			// const superAdminUser = await MainDataSource.getRepository(UserEntity).findOneOrFail({
			// 	where: { username: 'Graham' }
			// });
		if (space?.spaceType.logicType === SpaceTypeLogicType.INFO) return;
		const [stripe] = await this.getStripe(spaceId,userId,true);
		const [stripeUser] = await useStripe(userId);
		const stripeProductId = StripeService.getSpaceStripeId(spaceId);

		const images = space.photos && space.photos.length ? space.photos : space.venue.photos;

		const metadata = {
			createdByUserId: createdById,
			spaceId,
			env: NODE_ENV,
			serverUrl: SERVER_URL,
		};

		const priceObj: Stripe.PriceCreateParams = {
			currency: space.venue.currency.toLowerCase(),
			unit_amount_decimal: String(space.chargeType === ChargeType.FREE ? 0 : space.price * 100),
		};

		if (
			space &&
			([ChargeType.PRORATE_1, ChargeType.PRORATE, ChargeType.MONTHLY].includes(space.chargeType) ||
				(space.chargeType === ChargeType.FREE && [SpaceTypeLogicType.MONTHLY].includes(space.spaceType.logicType)))
		) {
			priceObj.recurring = { interval: 'month' };
		}

		try {
			const oldStripeProduct = await stripe.products.retrieve(stripeProductId);
			let oldStripeProductDD = null;
				//below is the new logic added for TD-804 to enable booking other brand packages for Dropdesk users
			if(await this.processFromStripeDD(space?.packageShow, space?.venue?.brandId, userId)){		
			oldStripeProductDD = await stripeUser.products.retrieve(stripeProductId);
		}
			try {
				const priceId =
					oldStripeProduct.default_price && typeof oldStripeProduct.default_price !== 'string'
						? oldStripeProduct.default_price.id
						: oldStripeProduct.default_price;

						const priceIdDD =
						oldStripeProductDD?.default_price && typeof oldStripeProductDD?.default_price !== 'string'
						? oldStripeProductDD?.default_price.id
						: oldStripeProductDD?.default_price;

				await this.spaceProviderDataRepo.save(
					this.spaceProviderDataRepo.create({
						provider: PaymentProvider.STRIPE,
						providerItemId: oldStripeProduct.id,
						providerItemPriceId: String(priceId),
						providerItemPriceIdDD : String(priceIdDD),
						spaceId,
					})
				);

				/**
				 * Stripe limits
				 * @link https://stripe.com/docs/rate-limits
				 */
				await delay(STRIPE_LIMIT_DELAY);
			} catch (e) {
				console.error(e);
				console.error((e as Error).message);
				return undefined;
			}
		} catch (e) {
			let newStripeProductDD = null;
				let priceIdDD = null
			try {
				
				try{
					//below is the new logic added for TD-804 to enable booking other brand packages for Dropdesk users
				if(await this.processFromStripeDD (space?.packageShow, space?.venue?.brandId, userId)){
				 newStripeProductDD = await stripeUser.products.create({
					id: stripeProductId,
					name: space.name,
					description: space.description || space.venue.description,
					images: images.map((f) => process.env.MEDIA_URL+'/434x176' + f.url),
					url: `https://${DOMAIN}${getSpaceUrl(space)}`,
					metadata,
					default_price_data: priceObj,
				});
				console.log ('newStripeProductDD : ' + JSON.stringify(newStripeProductDD));
				 priceIdDD = newStripeProductDD?.default_price && typeof newStripeProductDD.default_price !== 'string'
				? newStripeProductDD.default_price.id
				: newStripeProductDD?.default_price;
				}}
				catch(ex){
					console.error(ex);
					console.error((ex as Error).message + ' saving the new product to dropdesk stripe');
				}
				const newStripeProduct = await stripe.products.create({
					id: stripeProductId,
					name: space.name,
					description: space.description || space.venue.description,
					images: images.map((f) => process.env.MEDIA_URL+'/434x176' + f.url),
					url: `https://${DOMAIN}${getSpaceUrl(space)}`,
					metadata,
					default_price_data: priceObj,
				});
				
				const securityPriceObj: Stripe.PriceCreateParams = {
					nickname: 'Security Deposit',
					currency: space.venue.currency.toLowerCase(),
					unit_amount_decimal: String(space.securityDepositPrice * 100),
					product: stripeProductId,
					metadata,
				};

				const isSecurityDepositEnabled = await this.features.isEnabled(FeatureFlag.SecurityDeposit);
				if(isSecurityDepositEnabled){
				await stripe.prices.create(securityPriceObj);
				//below is the new logic added for TD-804 to enable booking other brand packages for Dropdesk users
				if(await this.processFromStripeDD(space?.packageShow, space?.venue?.brandId, userId)){
					await stripeUser.prices.create(securityPriceObj);	
								
				}
				
			}
			
				const priceId =
					newStripeProduct.default_price && typeof newStripeProduct.default_price !== 'string'
						? newStripeProduct.default_price.id
						: newStripeProduct.default_price;
			if(priceIdDD == undefined ) priceIdDD = null;
				await this.spaceProviderDataRepo.save(
					this.spaceProviderDataRepo.create({
						provider: PaymentProvider.STRIPE,
						providerItemId: newStripeProduct.id,
						providerItemPriceId: String(priceId),
						providerItemPriceIdDD: String(priceIdDD),
						spaceId,
					})
				);

				/**
				 * Stripe limits
				 * @link https://stripe.com/docs/rate-limits
				 */
				await delay(STRIPE_LIMIT_DELAY);

				return newStripeProduct;
			} catch (e) {
				console.error(e);
				console.error((e as Error).message);
				const err = e as Error;
				if(err.message.includes('Product already exists') && priceIdDD!=null && priceIdDD!=undefined ){
					//const space = await MainDataSource.getRepository(SpaceEntity).findOneOrFail({ where: { id: Number(stripeProductId) } });
					space.providerData[0].providerItemPriceIdDD = String(priceIdDD)
					await this.spaceProviderDataRepo.save(space);

				}
				return undefined;
			}
		}
	}

	/**
	 * Create Stripe space amenity product
	 * https://stripe.com/docs/api/products/create
	 * @todo refactor me
	 * @param userId
	 * @param amenityId
	 */
	async createSpaceAmenityProduct({
		userId,
		spaceAmenityId,
	}: {
		userId: number;
		spaceAmenityId: number;
	}): Promise<Stripe.Response<Stripe.Product> | undefined> {
		if (NODE_ENV === 'test') return;

		// const superAdminUser = await MainDataSource.getRepository(UserEntity).findOneOrFail({
		// 	where: { username: 'Graham' }
		// });
		const [stripe] = await this.getStripe(0,userId,true);
		const [stripeUser] = await useStripe(userId);
		

		const spaceAmenity = await this.spaceAmenityRepo
			.createQueryBuilder('a')
			.leftJoinAndSelect('a.amenity', 'amenity')
			.leftJoinAndSelect('a.space', 'space')
			.leftJoinAndSelect('space.venue', 'venue')
			.leftJoinAndSelect('venue.brand', 'brand')
			.leftJoinAndSelect('space.spaceType', 'spaceType')
			.where('a.id = :spaceAmenityId', { spaceAmenityId })
			.getOneOrFail();

		const stripeProductId = StripeService.getSpaceAmenityProductStripeId(spaceAmenityId, spaceAmenity.spaceId);

		const priceObj: Stripe.PriceCreateParams = {
			currency: spaceAmenity.space!.venue.currency.toLowerCase(),
			unit_amount_decimal: String(spaceAmenity.chargeType === ChargeType.FREE ? 0 : spaceAmenity.price * 100),
		};

		const metadata = {
			userId,
			spaceAmenityId,
			amenityId: spaceAmenity.amenityId,
			spaceId: spaceAmenity.spaceId,
			env: NODE_ENV,
			serverUrl: SERVER_URL,
		};

		if (
			spaceAmenity.space &&
			([ChargeType.PRORATE_1, ChargeType.PRORATE, ChargeType.MONTHLY].includes(spaceAmenity.space.chargeType) ||
				(spaceAmenity.space.chargeType === ChargeType.FREE && [SpaceTypeLogicType.MONTHLY].includes(spaceAmenity.space.spaceType.logicType)))
		) {
			priceObj.recurring = { interval: 'month' };
		}

		try {
			let oldStripeProductDD = null;
			const oldStripeProduct = await stripe.products.retrieve(stripeProductId);
			if(spaceAmenity.space?.packageShow ===PackageShow.PUBLIC && spaceAmenity.space.venue.brandId != DEFAULT_BRAND_ID){
			 oldStripeProductDD = await stripe.products.retrieve(stripeProductId); 
			console.log(JSON.stringify(oldStripeProductDD));
		}

			try {
				const priceId =
					oldStripeProduct.default_price && typeof oldStripeProduct.default_price !== 'string'
						? oldStripeProduct.default_price.id
						: oldStripeProduct.default_price;
				const priceDD =
				oldStripeProductDD?.default_price && typeof oldStripeProductDD?.default_price !== 'string'
						? oldStripeProductDD?.default_price.id
						: oldStripeProductDD?.default_price;

				await this.spaceAmenityProviderDataRepo.save(
					this.spaceAmenityProviderDataRepo.create({
						provider: PaymentProvider.STRIPE,
						providerItemId: oldStripeProduct.id,
						providerItemPriceId: String(priceId),
						providerItemPriceIdDD: String(priceDD),
						spaceAmenityId,
					})
				);
				//implement db changes here to create column for saving price id of spaceamenity in dropdesk account - TD-804
			} catch (e) {
				console.error(e);
				console.error((e as Error).message);
				return undefined;
			}
		} catch (e) {
			try {
				const prodParams: Stripe.ProductCreateParams = {
					id: stripeProductId,
					name: spaceAmenity.name && spaceAmenity.name.length ? spaceAmenity.name : spaceAmenity.amenity!.name,
					metadata,
					default_price_data: priceObj,
				};

				if (spaceAmenity.description && spaceAmenity.description.length) prodParams.description = spaceAmenity.description;
				let  newStripeProductDD = null;
				const newStripeProduct = await stripe.products.create(prodParams);
				if(spaceAmenity.space?.packageShow ===PackageShow.PUBLIC && spaceAmenity.space.venue.brandId != DEFAULT_BRAND_ID){
					newStripeProductDD = await stripeUser.products.create(prodParams);
					console.log(JSON.stringify(newStripeProductDD));
				}
				const priceIdDD =
				newStripeProductDD?.default_price && typeof newStripeProductDD?.default_price !== 'string'
						? newStripeProductDD?.default_price.id
						: newStripeProductDD?.default_price;
				
				const priceId =
					newStripeProduct.default_price && typeof newStripeProduct.default_price !== 'string'
						? newStripeProduct.default_price.id
						: newStripeProduct.default_price;

				await this.spaceAmenityProviderDataRepo.save(
					this.spaceAmenityProviderDataRepo.create({
						provider: PaymentProvider.STRIPE,
						providerItemId: newStripeProduct.id,
						providerItemPriceId: String(priceId),
						providerItemPriceIdDD: String(priceIdDD),
						spaceAmenityId,
					})
				);
				return newStripeProduct;
			} catch (e) {
				console.error(e);
				console.error((e as Error).message);
				return undefined;
			}
		}

		/**
		 * Stripe limits
		 * @link https://stripe.com/docs/rate-limits
		 */
		await delay(STRIPE_LIMIT_DELAY);
	}

	/**
	 * Delete Stripe space amenity product
	 * https://stripe.com/docs/api/products/delete
	 * @param userId
	 * @param amenityId
	 */
	async deleteSpaceAmenityProduct({
		userId,
		spaceAmenityId,
	}: {
		userId: number;
		spaceAmenityId: number;
	}): Promise<Stripe.Response<Stripe.DeletedProduct> | undefined> {
		if (NODE_ENV === 'test') return;

		const [stripeUser] = await useStripe(userId);
		const [stripe] = await this.getStripe(0,userId,true);

		const spaceAmenity = await this.spaceAmenityRepo.createQueryBuilder('a').where('a.id = :spaceAmenityId', { spaceAmenityId }).getOneOrFail();

		const stripeProductId = StripeService.getSpaceAmenityProductStripeId(spaceAmenityId, spaceAmenity.spaceId);

		const deleted = await stripe.products.del(stripeProductId);
		if(spaceAmenity.space?.packageShow ===PackageShow.PUBLIC && spaceAmenity.space.venue.brandId != DEFAULT_BRAND_ID)
		await stripeUser.products.del(stripeProductId);
		await this.spaceAmenityProviderDataRepo.delete({ spaceAmenityId });

		/**
		 * Stripe limits
		 * @link https://stripe.com/docs/rate-limits
		 */
		await delay(STRIPE_LIMIT_DELAY);
		return deleted;
	}

	/**
	 * Update Stripe product
	 * https://stripe.com/docs/api/products/update
	 * @param space
	 * @param spaceId
	 * @param userId
	 * @param updatedById
	 */
	async updateSpaceProduct({
		spaceId,
		userId,
		updatedById,
		providerId,
	}: {
		spaceId: number;
		updatedById: number;
		userId: number;
		providerId?: string | undefined;
	}): Promise<Stripe.Response<Stripe.Product> | void> {
		if (NODE_ENV === 'test') return;

		const space = await this.spaceRepo
			.createQueryBuilder('s')
			.leftJoinAndSelect('s.venue', 'venue')
			.leftJoinAndSelect('s.spaceType', 'spaceType')
			.leftJoinAndSelect('s.photos', 'photos')
			.leftJoinAndSelect('s.providerData', 'providerData')
			.leftJoinAndSelect('venue.photos', 'venuePhotos')
			.leftJoinAndSelect('venue.brand', 'brand')
			.where('s.id = :spaceId', { spaceId })
			.select([
				's.name',
				's.alias',
				's.description',
				's.price',
				'photos',
				'venue.id',
				'venue.alias',
				'venue.currency',
				'venue.country',
				'venue.city',
				'venue.brand',
				'venue.state',
				'venuePhotos',
				'spaceType',
			])
			.getOneOrFail();
			
		if (space?.spaceType.logicType === SpaceTypeLogicType.INFO) return;
		const [stripe] = await this.getStripe(spaceId, userId,true)
		const [stripeUser] = await useStripe(userId);

		const images = space.photos && space.photos.length ? space.photos : space.venue.photos;

		const metadata = {
			updatedByUserId: updatedById,
			spaceId,
			env: NODE_ENV,
			serverUrl: SERVER_URL,
		};

		const stripeProductId = providerId || StripeService.getSpaceStripeId(spaceId);

		const stripeProduct = await stripe.products.update(stripeProductId, {
			name: space.name,
			description: space.description,
			images: images.map((f) => process.env.MEDIA_URL + '/434x176' + f.url),
			url: `https://${DOMAIN}${getSpaceUrl(space)}`,
			metadata,
		});
			//below is the new logic added for TD-804 to enable booking other brand packages for Dropdesk users
		if( await this.processFromStripeDD(space?.packageShow, space?.venue?.brandId, userId)){	
			await stripeUser.products.update(stripeProductId, {
			name: space.name,
			description: space.description,
			images: images.map((f) => process.env.MEDIA_URL + '/434x176' + f.url),
			url: `https://${DOMAIN}${getSpaceUrl(space)}`,
			metadata,
		});
	}

		/**
		 * Stripe limits
		 * @link https://stripe.com/docs/rate-limits
		 */
		await delay(STRIPE_LIMIT_DELAY);
		return stripeProduct;
	}

	/**
	 * Update Stripe space amenity product
	 * https://stripe.com/docs/api/products/update
	 * @param space
	 * @param providerId
	 * @param userId
	 * @param updatedById
	 */
	async updateSpaceAmenityProduct({
		spaceAmenityId,
		userId,
		updatedById,
		providerId,
	}: {
		spaceAmenityId: number;
		updatedById: number;
		userId: number;
		providerId?: string | undefined;
	}): Promise<Stripe.Response<Stripe.Product> | void> {
		if (NODE_ENV === 'test') return;

		const [stripeUser] = await useStripe(userId);
		const [stripe] = await this.getStripe(0, userId,true)

		const spaceAmenity = await this.spaceAmenityRepo
			.createQueryBuilder('a')
			.leftJoinAndSelect('a.amenity', 'amenity')
			.leftJoinAndSelect('a.providerData', 'providerData')
			.leftJoinAndSelect('a.space', 'space')
			.leftJoinAndSelect('space.venue', 'venue')
			.leftJoinAndSelect('venue.brand', 'brand')
			.leftJoinAndSelect('space.spaceType', 'spaceType')
			.where('a.id = :spaceAmenityId', { spaceAmenityId })
			.getOneOrFail();

		const stripeProductId = providerId || StripeService.getSpaceAmenityProductStripeId(spaceAmenityId, spaceAmenity.spaceId);

		const metadata = {
			updatedByUserId: updatedById,
			spaceAmenityId,
			env: NODE_ENV,
			serverUrl: SERVER_URL,
		};

		try {
			await stripe.products.retrieve(stripeProductId);
			const prodData: Stripe.ProductUpdateParams = {
				name: spaceAmenity.name && spaceAmenity.name.length ? spaceAmenity.name : spaceAmenity.amenity!.name,
				metadata,
			};
			if (spaceAmenity.description && spaceAmenity.description.length) prodData.description = spaceAmenity.description;
			if(spaceAmenity.space?.packageShow ===PackageShow.PUBLIC && spaceAmenity.space.venue.brandId != DEFAULT_BRAND_ID)
			await stripeUser.products.update(stripeProductId, prodData);
			return await stripe.products.update(stripeProductId, prodData);
		} catch (e) {
			loggerHelper.error(e);
			return this.createSpaceAmenityProduct({
				spaceAmenityId,
				userId,
			});
		}
	}

	/**
	 * Get Stripe invoice by id
	 * https://stripe.com/docs/api/invoices/retrieve
	 * @param invoiceId
	 * @param userId
	 */
	async getInvoiceById(invoiceId: string, userId: number): Promise<Stripe.Response<Stripe.Invoice>> {
		const [stripe] = await this.getStripe(0, userId, false)
		return await stripe.invoices.retrieve(invoiceId, {
			expand: [
				'from_invoice.invoice',
				'lines.data.price',
				'lines.data.price.product',
				'lines.data.price_details',
				'subscription',
				'customer',
				'charge',
			],
		});
	}

	/**
	 * Get Stripe price by id
	 * https://stripe.com/docs/api/prices/retrieve
	 * @param priceId
	 * @param userId
	 */
	async getPriceById(priceId: string, userId: number): Promise<Stripe.Response<Stripe.Price>> {
		const [stripe] = await this.getStripe(0, userId,false)
		return await stripe.prices.retrieve(priceId);
	}

	/**
	 * Create Stripe invoice
	 * https://stripe.com/docs/api/invoices/create
	 * @param space
	 * @param appInvoice
	 * @param userId
	 */
	async createInvoice({
		spaceId,
		appInvoice,
		userId,
		quantity = 1,
	}: {
		spaceId: number;
		appInvoice: InvoiceEntity;
		userId: number;
		quantity?: number;
	}): Promise<Stripe.Invoice> {
		const [stripe, customerId] = await this.getStripe(spaceId, userId,false)

		const customer: Stripe.Customer = (await stripe.customers.retrieve(customerId)) as Stripe.Customer;

		if (!customer.default_source) {
			const teamMemRepo = MainDataSource.getRepository(TeamMemberEntity);
					const teamMember = await teamMemRepo.findOne({ where: { memberId: Number(userId) } });
					if(teamMember && teamMember.isTeamLead === false)
					{
						const teamRepo = MainDataSource.getRepository(TeamEntity);
						const team = await teamRepo.findOne({ where: { id: Number(teamMember.teamId) } });
						if(team)
							{
								const [stripe, customerId] = await this.getStripe(spaceId, team.teamLeadId, false);
								const customerLead: Stripe.Customer = (await stripe.customers.retrieve(customerId)) as Stripe.Customer;
								if (!customerLead.default_source) {
									loggerHelper.error('user has no default payment method!', { userId, customerId });
									throw new ForbiddenResponse({ message: 'No default payment method!' });
								}
								
							}
					}
		}

		const stripeProduct = await this.getProductBySpaceId(spaceId, userId);

		if (!stripeProduct || !stripeProduct.default_price) throw new Error('No default price!');

		const invoiceItemsData: Stripe.InvoiceItemCreateParams = {
				customer: customerId,
				currency: appInvoice.currency,
			};

		if (Number.isInteger(quantity)) {
			invoiceItemsData.price = stripeProduct.default_price as string;
			invoiceItemsData.quantity = quantity;
		} else {
			invoiceItemsData.price_data = {
				currency: appInvoice.currency,
				product: stripeProduct.id,
				unit_amount_decimal: String((appInvoice.subTotal + appInvoice.tax) * 100),
			};
		}

		await stripe.invoiceItems.create(invoiceItemsData);

		const stripeInvoice = await stripe.invoices.create({
				customer: customerId,
				currency: appInvoice.currency,
				pending_invoice_items_behavior: 'include',
				metadata: {
					invoiceId: appInvoice.id,
					userId: appInvoice.userId,
					reservationId: appInvoice.reservationId,
					env: NODE_ENV,
					serverUrl: SERVER_URL,
				},
			});

			await delay(STRIPE_LIMIT_DELAY);

		if (stripeInvoice.id) return await stripe.invoices.pay(stripeInvoice.id);

		/**
		 * Stripe limits
		 * @link https://stripe.com/docs/rate-limits
		 */
		return stripeInvoice;
	}

	/**
	 * Create Stripe invoice
	 * https://stripe.com/docs/api/invoices/create
	 * @param space
	 * @param appInvoice
	 * @param userId
	 */
	async createSecurityDepositInvoice({
		spaceId,
		appInvoice,
		userId,
	}: {
		spaceId: number;
		appInvoice: InvoiceEntity;
		userId: number;
	}) {
		const [stripe, customerId] = await this.getStripe(spaceId, userId,false)

		const stripeProduct = await this.getProductBySpaceId(spaceId, userId);

		if (!stripeProduct || !stripeProduct.default_price) return;

		const priceList = await stripe.prices.list({
			product: stripeProduct.id,
		});

		const securityDepositPrice = priceList.data.find((price) => price.nickname === 'Security Deposit');
		if (securityDepositPrice) {
			const securityInvoiceItemsData: Stripe.InvoiceItemCreateParams = {
			description: 'Invoice for Security Deposit',
			customer: customerId,
			currency: appInvoice.currency,
		};
			securityInvoiceItemsData.price = securityDepositPrice.id as string;
			securityInvoiceItemsData.quantity = 1;
			securityInvoiceItemsData.metadata= {
				description: 'Invoice for Security Deposit',
			  },

				await stripe.invoiceItems.create(securityInvoiceItemsData);

			const stripeSecurityDepositInvoice = await stripe.invoices.create({
			customer: customerId,
			currency: appInvoice.currency,
				description: 'Invoice for Security Deposit',
			pending_invoice_items_behavior: 'include',
			metadata: {
				invoiceId: appInvoice.id,
				userId: appInvoice.userId,
				reservationId: appInvoice.reservationId,
				env: NODE_ENV,
				serverUrl: SERVER_URL,
			},
		});

		await delay(STRIPE_LIMIT_DELAY);

			if (stripeSecurityDepositInvoice.id) await stripe.invoices.pay(stripeSecurityDepositInvoice.id);
			console.log('Invoice payment for security deposit', { appInvoice, data: userId, stripeSecurityDepositInvoice });
		}

		}
	/**
	 * Get Stripe subscription by id
	 * https://stripe.com/docs/api/subscriptions/retrieve
	 * @param subscriptionId
	 * @param userId
	 */
	async getSubscriptionById(subscriptionId: string, userId: number): Promise<Stripe.Response<Stripe.Subscription>> {
		const [stripe] = await this.getStripe(0, userId,false)
		return await stripe.subscriptions.retrieve(subscriptionId);
	}

	/**
	 * Get Stripe upcoming invoice by subscription id
	 * https://stripe.com/docs/api/invoices/upcoming
	 * @param subscriptionId
	 * @param userId
	 */
	async getSubscriptionUpcomingInvoice(subscriptionId: string, userId: number): Promise<Stripe.Response<Stripe.Invoice>> {
		const [stripe, customerId] = await this.getStripe(0, userId,false)
		return await stripe.invoices.retrieveUpcoming({
			subscription: subscriptionId,
			customer: customerId,
			expand: [
				'from_invoice.invoice',
				'lines.data.price',
				'lines.data.price.product',
				'lines.data.price_details',
				'subscription',
				'customer',
				'charge',
			],
		});
	}

	/**
	 * Get Stripe charge by id
	 * @param chargeId
	 * @param userId
	 */
	async getChargeById(chargeId: string, userId: number): Promise<Stripe.Response<Stripe.Charge>> {
		const [stripe] = await this.getStripe(0, userId,false)
		return await stripe.charges.retrieve(chargeId);
	}

	/**
	 * Get Stripe product by space id
	 * @param spaceId
	 * @param userId
	 */
	async getProductBySpaceId(spaceId: number, userId: number): Promise<Stripe.Response<Stripe.Product> | undefined> {
			const [stripe] = await this.getStripe(spaceId, userId, false)
			let stripeProduct;
		try {
			stripeProduct = await stripe.products.retrieve(StripeService.getSpaceStripeId(spaceId));
			console.log("stripe product price : " + stripeProduct.default_price)
			console.log("stripe product : "+ stripeProduct)
		} catch (e) {
			stripeProduct = await this.createSpaceProduct({
				userId,
				createdById: userId,
				spaceId,
			});
		}
		return stripeProduct;
	}

	/**
	 * Get Stripe product by space amenity id
	 * @param spaceId
	 * @param spaceAmenityId
	 * @param userId
	 */
	async getProductBySpaceAmenityId(spaceId: number, spaceAmenityId: number, userId: number): Promise<Stripe.Response<Stripe.Product> | undefined> {
		const [stripe] = await this.getStripe(spaceId, userId,false)
		let stripeProduct;
		try {
			stripeProduct = await stripe.products.retrieve(StripeService.getSpaceAmenityProductStripeId(spaceAmenityId, spaceId));
		} catch (e) {
			stripeProduct = await this.createSpaceAmenityProduct({
				userId,
				spaceAmenityId,
			});
		}
		return stripeProduct;
	}

	/**
	 * Update stripe customer data
	 * https://stripe.com/docs/api/customers/update
	 * @param userId
	 */
	async updateUserInfo(userId: number) {
		if (NODE_ENV === 'test') return;

		const [stripe] = await useStripe(userId)
		const user = await MainDataSource.getRepository(UserEntity).findOneOrFail({
			where: { id: userId },
			select: ['id', 'firstname', 'lastname', 'email', 'phone', 'brandId', 'stripeCustomerId'],
		});
		return await stripe.customers.update(user.stripeCustomerId, {
			email: user.email,
			phone: String(user.phone),
			name: `${user.firstname} ${user.lastname}`,
			metadata: { brandId: user.brandId, userId: user.id, env: NODE_ENV },
		});
	}

	/**
	 * Create stripe customer
	 * https://stripe.com/docs/api/customers/create
	 * @param userId
	 * @param paymentSourceId
	 */
	async createUser(userId: number, paymentSourceId?: string) {
		if (NODE_ENV === 'test') return;

		const [stripe] = await useStripe(userId);
		const user = await MainDataSource.getRepository(UserEntity).findOneOrFail({
			where: { id: userId },
			select: ['id', 'firstname', 'lastname', 'email', 'phone', 'brandId'],
		});
		const userParams: Stripe.CustomerCreateParams = {
			email: user.email,
			phone: String(user.phone),
			name: `${user.firstname} ${user.lastname}`,
			metadata: { brandId: user.brandId, userId: user.id, env: NODE_ENV },
		};

		if (paymentSourceId) {
			userParams.source = paymentSourceId;
		}

		const newUser = await stripe.customers.create(userParams);

		await MainDataSource.getRepository(UserEntity).save({ ...user, stripeCustomerId: newUser.id });
		return newUser;
	}

	static getSpaceStripeId(spaceId: number) {
		return `space-${NODE_ENV}-${spaceId}`;
	}

	static getSpaceAmenityProductStripeId(spaceAmenityId: number, spaceId: number) {
		return `space-${NODE_ENV}-${spaceId}-space-amenity-${spaceAmenityId}`;
	}

	/**
	 *
	 * @param productId
	 */
	getProductEnvFromId(productId: string): string {
		return productId.split('-')[1];
	}

	/**
	 * Check invoice environment
	 * @todo: check better way than 1st item
	 * @param invoice
	 */
	async checkInvoiceProductEnv({ invoice }: { invoice: Stripe.Invoice }) {
		const lineWithProduct = invoice.lines.data.find((lineData) => !!lineData.price?.product);
		if (!lineWithProduct) return true;
		const productEnv = this.getProductEnvFromId(lineWithProduct.price!.product as string);
		if (productEnv !== NODE_ENV) {
			throw new Error(`Invoice product env does not match current env: ${productEnv}`);
		}
	}

	/**
	 * Refund stripe invoice
	 * https://stripe.com/docs/api/refunds/create
	 * @param stripeInvoiceId
	 * @param userId
	 */
	async refundInvoice(stripeInvoiceId: string, userId: number) {
		const [stripe] = await this.getStripe(0, userId,false)

		const stripeInvoice = await stripe.invoices.retrieve(stripeInvoiceId);

		return await stripe.refunds.create({
			charge: stripeInvoice.charge as string,
		});
	}

	async getStripe (spaceId: number = 0, userId: number, isSpaceCreateorUpdate : boolean): Promise<[Stripe, string, UserEntity]> {
		const isBookingFromOtherBrandEnabled =  await this.features.isEnabled(FeatureFlag.isBookingFromOtherBrandEnabled)
		let spaceDetails = await MainDataSource.getRepository(SpaceEntity).findOne({
			where: { id: Number(spaceId) },
			select: {
				id: true,
				venueId: true,
				packageShow: true,
			},
		});

		if(!spaceDetails) return await useStripe(userId, false, 0 );
		
		let venueDetails = await MainDataSource.getRepository(VenueEntity).findOneOrFail({
			where: { id: Number(spaceDetails?.venueId) },
			select: {
				id: true,
				brandId: true,
			},
		});

		if(!venueDetails) return await useStripe(userId, false, 0 );

		let userDetails = await MainDataSource.getRepository(UserEntity).findOneOrFail({
			where: { id: Number(userId) }
		});
		if(spaceDetails.packageShow == PackageShow.PUBLIC && venueDetails.brandId != userDetails.brandId && !isSpaceCreateorUpdate && isBookingFromOtherBrandEnabled){
			return await useStripe(userDetails.id, false, 0 );
		}

		return await useStripe(userId, false, venueDetails?.brandId );
	}

}
