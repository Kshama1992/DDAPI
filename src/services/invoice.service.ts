import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import dayjsutc from 'dayjs/plugin/utc';
import dayjsduration from 'dayjs/plugin/duration';
import dayjstimezone from 'dayjs/plugin/timezone';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { Brackets, IsNull, WhereExpressionBuilder } from 'typeorm';
import InvoiceEntity from '@entity/invoice.entity';
import loggerHelper from '@helpers/logger.helper';
import SpaceEntity from '@entity/space.entity';
import SpaceStatus from 'dd-common-blocks/dist/type/SpaceStatus';
import InvoiceItemEntity from '@entity/invoice-item.entity';
import UserEntity from '@entity/user.entity';
import InvoiceStatusEntity from '@entity/invoice-status.entity';
import SpaceAmenityEntity from '@entity/space-amenity.entity';
import { useStripe } from '@helpers/stripe.helper';
import ReservationEntity from '@entity/reservation.entity';
import SubscriptionEntity from '@entity/subscription.entity';
import UserPrivatePackageEntity from '@entity/user-private-package.entity';
import SpaceCreditHoursEntity from '@entity/space-credit-hours.entity';
import { sendUserDefinedTemplate } from '@helpers/send-mail.helper';
import FileEntity from '@entity/file.entity';
import PaymentDataEntity from '@entity/payment-data';
import RefundDataEntity from '@entity/refund-data';
import RefundEntity from '@entity/refund.entity';
import SubscriptionCreditHoursEntity from '@src/entity/subscription-credit-hours.entity';
import { AUTO_CHECKOUT_DAYS, DEFAULT_BRAND_NAME, DEFAULT_CURRENCY, DOMAIN, NODE_ENV, MEDIA_URL, SERVER_URL } from '@src/config';
import {
	getCurrencySymbol,
	getPriceByChargeType,
} from 'dd-common-blocks';
import { Stripe } from 'stripe';
import { isAccess247 } from '@helpers/subscription.helper';
import SecondsToTimeHelper from '@helpers/seconds-to-time.helper';
import AccessCustomDataEntity from '@entity/access-custom-data.entity';
import TeamService from '@services/team.service';
import TeamEntity from '@entity/team.entity';
import BrandEntity from '@entity/brand.entity';
import UserService from '@services/user.service';
import ChargeType from 'dd-common-blocks/dist/type/ChargeType';
import SpaceTypeLogicType from 'dd-common-blocks/dist/type/SpaceTypeLogicType';
import HoursType from 'dd-common-blocks/dist/type/HoursType';
import PaymentProvider from 'dd-common-blocks/dist/type/PaymentProvider';
import PackageShow from 'dd-common-blocks/dist/type/PackageShow';
import PackageStatus from 'dd-common-blocks/dist/type/PackageStatus';
import {
	_calcItemHours,
	getInvoiceNumber,
	getInvoiceProcessingDateString,
	getInvoicePayDateString,
	getInvoiceCredits,
	getInvoiceFullPriceString,
} from '@utils/lib/invoice';
import ReservationStatus from 'dd-common-blocks/dist/type/ReservationStatus';
import SubscriptionStatus from 'dd-common-blocks/dist/type/SubscriptionStatus';
import { ForbiddenResponse } from '@utils/response/forbidden.response';
import TeamMemberStatus from 'dd-common-blocks/dist/type/TeamMemberStatus';
import CreditRotationType from 'dd-common-blocks/dist/type/CreditRotationType';
import SubscriptionService from '@services/subscription.service';
import { NotFoundErrorResp } from '@utils/response/not-found.response';
import { ValidationErrorResp } from '@utils/response/validation-error.response';
import { ErrorResponse } from '@utils/response/error.response';
import Socket from '@src/socket';
import SocketEventsType from 'dd-common-blocks/dist/type/SocketEventsType';
import { Inject, Service } from 'typedi';
import MainDataSource from '../main-data-source';
import { NotFoundError } from 'routing-controllers';
import InvoiceProviderDataEntity from '@entity/invoice-provider-data.entity';
import StripeService from '@services/stripe.service';
import SubscriptionProviderDataEntity from '@entity/subscription-provider-data.entity';
import CreateInvoiceDto from '@src/dto/create-invoice.dto';
import CreateInvoiceItemDto from '@src/dto/create-invoice-item.dto';
import QueryInvoiceDto from '@src/dto/query-invoice.dto';
import CheckInDto from '@src/dto/check-in.dto';
import CheckOutDto from '@src/dto/check-out.dto';
import ChangeInvoiceStatusDto from '@src/dto/change-invoice-status.dto';
import InvoiceItemType from 'dd-common-blocks/dist/type/InvoiceItemType';
import VenueEntity from '@src/entity/venue.entity';
import SecurityDepositStatusEntity from '@src/entity/securityDeposit-status.entity';
import { FeatureFlag } from '@src/utils/feature-flag';
import { Features } from '@src/utils/features';
import { sendBookingSMS } from '@src/utils/helpers/sms-helper';
import {InvoiceStatus} from '@src/utils/invoiceStatus';
import PaymentModeEntity from '@src/entity/payment-mode.entity';
import TeamMemberEntity from '@src/entity/team-member.entity';
import InstantlyBookableConversationEntity from '@src/entity/InstantlyBookable-conversation.entity';
import { sendHostRequestSMS } from '@src/utils/helpers/host-approval-sms.helper';
import { getVenueOperationTime } from '@src/utils/helpers/venue-operation-time-helper';

dayjs.extend(customParseFormat);
dayjs.extend(dayjsutc);
dayjs.extend(dayjstimezone);
dayjs.extend(dayjsduration);
dayjs.extend(isSameOrBefore);

export enum InvoiceEmailTypes {
	DEFAULT = 'default',
	UPCOMING = 'upcoming',
	CHECK_IN = 'check-in',
	CHECK_OUT = 'check-out',
	RESERVATION_CHANGED = 'reservation-changed',
	REBOOKING_REMINDER = 'rebooking-reminder',
}

interface SingleInvoiceWebResp extends InvoiceEntity {
	stripeInvoice?: Stripe.Invoice;
}

/**
 * Handle all actions with invoices.
 * @module Invoice service
 * @category Services
 */
@Service()
export default class InvoiceService {
	@Inject()
	stripeService: StripeService;

	@Inject()
	subscriptionService: SubscriptionService;

	features: Features;

	entity = InvoiceEntity;

	subscriptionRepository = MainDataSource.getRepository(SubscriptionEntity);
	reservationRepository = MainDataSource.getRepository(ReservationEntity);
	spaceRepository = MainDataSource.getRepository(SpaceEntity);
	invoiceRepository = MainDataSource.getRepository(InvoiceEntity);
	invoiceItemRepository = MainDataSource.getRepository(InvoiceItemEntity);
	brandRepository = MainDataSource.getRepository(BrandEntity);
	userRepository = MainDataSource.getRepository(UserEntity);
	invoiceProviderDataRepository = MainDataSource.getRepository(InvoiceProviderDataEntity);

	constructor() {
        this.features = new Features();
    }

	async _updateObjWithStripeInvoice(invoice: SingleInvoiceWebResp): Promise<SingleInvoiceWebResp> {
		try {
			console.log('Inside _updateObjWithStripeInvoice ');
			if (invoice.providerData && invoice.providerData.length && invoice.providerData[0].providerInvoiceId) {
				invoice.stripeInvoice = await this.stripeService.getInvoiceById(invoice.providerData[0].providerInvoiceId, invoice.userId);
			} else if (invoice.subscriptionId && invoice.space?.spaceType?.logicType === SpaceTypeLogicType.MONTHLY) {
				// stripe will throw error if subscription is canceled
				if (invoice.subscription && invoice.subscription.status !== SubscriptionStatus.ACTIVE) return invoice;
				try {
					const subscriptionProviderData = await MainDataSource.getRepository(SubscriptionProviderDataEntity).findOne({
						where: { subscriptionId: invoice.subscriptionId },
					});
					if (subscriptionProviderData) {
						invoice.stripeInvoice = await this.stripeService.getSubscriptionUpcomingInvoice(
							subscriptionProviderData.providerSubscriptionId,
							invoice.userId
						);
					}
				} catch {
					return invoice;
				}
			}

			if (invoice.stripeInvoice) {
				const getLineItemPeriodString = (item: any, type: 'start' | 'end') => {
					return dayjs.unix(item.period[type]).format('MMM D YYYY');
				};

				invoice.items = await Promise.all(
					invoice.stripeInvoice.lines.data.map(async (item: Stripe.InvoiceLineItem) => {
						const name =
							item.type === 'invoiceitem' ? item.description : (item.price?.product as Stripe.Product).name || item.description;
						const nameAdditional =
							invoice.space.spaceType.logicType === SpaceTypeLogicType.MONTHLY
								? `(${getLineItemPeriodString(item, 'start')} - ${getLineItemPeriodString(item, 'end')})`
								: '';

						let price = (item.price?.unit_amount || 0) / 100;
						if ([SpaceTypeLogicType.HOURLY, SpaceTypeLogicType.MINUTELY].includes(invoice.space.spaceType.logicType) && item.price) {
							const tempPrice = await this.stripeService.getPriceById(
								((item.price as Stripe.Price).product as Stripe.Product).default_price as string,
								invoice.userId
							);
							price = (tempPrice.unit_amount || 0) / 100;
						}

						const ret: any = {
							price,
							price2: item.amount / 100,
							name: `${name} ${nameAdditional}`,
							quantity: item.quantity,
						};

						const stripeProductId = ((item.price as Stripe.Price).product as Stripe.Product).id;

						const isAmenity = stripeProductId.includes('amenity');

						if (!isAmenity) {
							const spaceId = stripeProductId.replace(/\D/g, '');
							const appInvoiceLine = invoice.items?.find(
								(appItem) => appItem.invoiceItemType === InvoiceItemType.SPACE && Number(appItem.spaceId) === Number(spaceId)
							);
							if (appInvoiceLine) {
								ret.id = appInvoiceLine.id;
								ret.hours = appInvoiceLine.quantity;
								ret.quantity = appInvoiceLine.quantity;
								ret.creditHours = appInvoiceLine.creditHours;
								ret.tax = appInvoiceLine.tax;
								ret.chargeType = appInvoiceLine.chargeType;
								ret.invoiceItemType = appInvoiceLine.invoiceItemType;
							}
						}
						return ret;
					})
				);
			}
			console.log('returning invoice without error '+ String(invoice));
			return invoice;
		} catch (e) {
			console.error(e);
			return invoice;
		}
	}

	/**
	 * Method to get invoice status entity by its name
	 * @param {string} name - Invoice status name
	 * @returns {InvoiceStatusEntity} Invoice status object from db
	 */
	async _getStatusByName(name: string): Promise<InvoiceStatusEntity | null> {
		return MainDataSource.getRepository(InvoiceStatusEntity).findOne({ where: { name } });
	}

	async _getSecurityStatusByName(name: string): Promise<SecurityDepositStatusEntity | null> {
		return MainDataSource.getRepository(SecurityDepositStatusEntity).findOne({ where: { name } });
	}

	/**
	 * Create space item for invoice items array
	 * @param { SpaceEntity } space - space object with spaceType relation.
	 * @param { CreateInvoiceDto } data - data from HTTP request
	 * @param { boolean } isUpcoming - is this item is for upcoming invoice. Mostly for PRORATE and PRORATE_1 space types (use full month or not)
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @return { InvoiceItemEntity } Space invoice item without id.
	 */
	async _createSpaceItem(
		space: SpaceEntity,
		data: CreateInvoiceDto,
		isUpcoming = false,
		requestedByUser?: UserEntity | undefined
	): Promise<InvoiceItemEntity> {
		console.log('Inside _createSpaceItem ');
		const { userId, createdById, useCredits = true } = data;

		const userService = new UserService();

		const item: InvoiceItemEntity = this.invoiceItemRepository.create();
		item.quantity = 1;
		item.creditHours = 0;
		item.amenityHoursIncluded = 0;
		item.paid = false;

		const realPrice: number = getPriceByChargeType(Number(space.price), space.chargeType);

		item.price = Number(space.price);
		item.price2 = Number(realPrice);

		if (space.chargeType === ChargeType.FREE) {
			item.price = 0;
			item.price2 = 0;
		}
		console.log('space details1 '+ String(space));

		if(await this.features.isEnabled(FeatureFlag.hourlyChargeForDaypass)){
			if (([SpaceTypeLogicType.MINUTELY, SpaceTypeLogicType.HOURLY].includes(space.spaceType.logicType!)) || (([ SpaceTypeLogicType.DAILY,SpaceTypeLogicType.EVENT].includes(space.spaceType.logicType!)) && (space.chargeType == ChargeType.HOURLY))) {
			const { startDate, endDate } = data;
			item.quantity = _calcItemHours({ startDate, endDate, space });
			let timePrice = Number((item.quantity * space.price).toFixed(3));

			if (!space.notAllowCredit && item.quantity > 0 && useCredits) {
				let credits : any ;
				if(!([ SpaceTypeLogicType.DAILY].includes(space.spaceType.logicType!)) ){
				 credits = await userService._calcSpaceHours(String(userId), [space.id], item.quantity, requestedByUser);
				}
				if (Array.isArray(credits)) {
					if (space.chargeType === ChargeType.FREE){
						item.creditHours = 0;
					}
					else{
						item.creditHours = credits[0]? credits[0].creditHours : 0 ;
					}
					if([SpaceTypeLogicType.EVENT].includes(space.spaceType.logicType!)){
						timePrice = Number((item.quantity * space.price).toFixed(3));
					}
					else{
					timePrice = Number((credits[0].billable * space.price).toFixed(3));
					}
				}
			}
			item.price2 = timePrice;
		}
	}
	else{
		if ([SpaceTypeLogicType.MINUTELY, SpaceTypeLogicType.HOURLY].includes(space.spaceType.logicType!)) {
			const { startDate, endDate } = data;
			item.quantity = _calcItemHours({ startDate, endDate, space });
			let timePrice = Number((item.quantity * space.price).toFixed(3));

			if (!space.notAllowCredit && item.quantity > 0 && useCredits) {
				const credits = await userService._calcSpaceHours(String(userId), [space.id], item.quantity, requestedByUser);
				if (Array.isArray(credits)) {
					if (space.chargeType === ChargeType.FREE){
						item.creditHours = 0;
					}
					else{
						item.creditHours = credits[0].creditHours;
					}
					timePrice = Number((credits[0].billable * space.price).toFixed(3));
				}
			}
			item.price2 = timePrice;
		}

	}

		item.name = space.name;
		item.paidAmount = 0;
		item.createdById = Number(createdById || userId);
		item.updatedById = Number(createdById || userId);
		item.dateBought = (data.userTz ? dayjs.tz(dayjs(), data.userTz) : dayjs()).toDate();
		item.spaceId = space.id;
		item.venueId = space.venueId;
		item.refunded = false;
		item.tax = space.tax || 0;
		item.chargeType = space.chargeType;
		item.invoiceItemType = InvoiceItemType.SPACE;
		console.log('space details1 '+ String(space));
		console.log('item details '+ String(item));
		return item;
	}

	/**
	 * Creates deposit invoice item for invoice items array
	 * @param {SpaceEntity} space - space object
	 * @param {CreateInvoiceDto} data - data from HTTP request
	 * @return {InvoiceItemEntity} Deposit invoice item without id.
	 */
	_createDepositItem(space: SpaceEntity, data: CreateInvoiceDto): InvoiceItemEntity {
		const { userId, createdById } = data;
		const depositItem = this.invoiceItemRepository.create();

		const itemPrice = space.securityDepositPrice ? space.securityDepositPrice : 0;
		const itemRealPrice = Number(itemPrice);

		depositItem.name = 'Security Deposit';
		depositItem.price = Number(itemPrice);
		depositItem.price2 = Number(itemRealPrice);
		depositItem.tax = 0;
		depositItem.dateBought = (data.userTz ? dayjs().tz(data.userTz) : dayjs()).toDate();
		depositItem.spaceId = space.id;
		depositItem.venueId = space.venueId;
		depositItem.paid = false;
		depositItem.paidAmount = 0;
		depositItem.refunded = false;
		depositItem.invoiceItemType = InvoiceItemType.SECURITY_DEPOSIT;
		depositItem.chargeType = ChargeType.ONE_TIME;
		depositItem.createdById = Number(createdById || userId);
		depositItem.updatedById = Number(createdById || userId);
		depositItem.quantity = 1;
		depositItem.creditHours = 0;
		depositItem.amenityHoursIncluded = 0;
		console.log('depositItem details '+ String(depositItem));
		return depositItem;
	}

	/**
	 * Creates amenity invoice item for invoice items array
	 * @param {SpaceAmenityEntity} amenity
	 * @param {SpaceEntity} space
	 * @param {CreateInvoiceDto} data
	 * @return {InvoiceItemEntity} Amenity invoice item without id.
	 */
	_createAmenityItem(amenity: SpaceAmenityEntity, space: SpaceEntity, data: CreateInvoiceDto): InvoiceItemEntity {
		const { userId, createdById } = data;
		const amenityItem = this.invoiceItemRepository.create();

		const aPrice = amenity.price ? amenity.price : 0;

		const aRealPrice = getPriceByChargeType(aPrice, amenity.chargeType ? amenity.chargeType : '');

		amenityItem.price = Number(aPrice);
		amenityItem.price2 = Number(aRealPrice);

		if (amenity.chargeType === ChargeType.FREE) {
			amenityItem.price = 0;
			amenityItem.price2 = 0;
		}

		if (amenity.chargeType === ChargeType.HOURLY) {
			const { startDate, endDate } = data;
			amenityItem.quantity = _calcItemHours({ startDate, endDate });
			// const timePrice = Number((amenityItem.quantity * aRealPrice).toFixed(3));
			// amenityItem.price = timePrice;
			amenityItem.price2 = Number((amenityItem.quantity * aRealPrice).toFixed(3));
		}

		amenityItem.name = amenity.name !== '' ? amenity.name : amenity.amenity!.name;
		amenityItem.tax = amenity.salesTax || 0;
		amenityItem.dateBought = new Date();
		amenityItem.spaceId = space.id;
		amenityItem.venueId = space.venueId;
		amenityItem.paidAmount = 0;
		amenityItem.refunded = false;
		amenityItem.createdById = Number(createdById || userId);
		amenityItem.updatedById = Number(createdById || userId);
		amenityItem.paid = false;
		amenityItem.chargeType = amenity.chargeType;
		amenityItem.invoiceItemType = InvoiceItemType.AMENITY;
		amenityItem.quantity = 0;
		amenityItem.creditHours = 0;
		amenityItem.amenityHoursIncluded = 0;

		return amenityItem;
	}

	/**
	 * Creates invoice with status "Upcoming".
	 * @param {number} invoiceId
	 * @param {string} inputProcessDate format 'YYYY-MM-DD'
	 * @return {Promise<void>}
	 */
	async _saveUpcoming(invoiceId: number, inputProcessDate?: string): Promise<void> {
		try {
			const invoice = await this.getFullInvoice(invoiceId);

			// check for already created upcoming invoices
			const upcomingInvoiceStatus = (await this._getStatusByName('Upcoming')) || undefined;

			if (upcomingInvoiceStatus && upcomingInvoiceStatus.id && invoice.reservationId) {
				const alreadyHave = await this.invoiceRepository.findOne({
					where: {
						reservationId: invoice.reservationId,
						invoiceStatusId: upcomingInvoiceStatus.id,
						securityDepositStatusId: upcomingInvoiceStatus.id,
					},
				});
				if (alreadyHave) return;
			}

			const upcoming: InvoiceEntity = { ...invoice };
			upcoming.subTotal = upcoming.items[0].price;

			const query = this.invoiceRepository.createQueryBuilder('invoice');
			query.select('MAX(invoice.invoiceNumber)', 'max');
			const lastInvoiceNumberQ = await query.getRawOne();
			upcoming.invoiceNumber = lastInvoiceNumberQ.max + 1;

			upcoming.items = invoice.items.map((i) => {
				const clonedI = i;

				// @ts-ignore
				delete clonedI.id;
				// @ts-ignore
				delete clonedI.payDate;
				// @ts-ignore
				delete clonedI.createdAt;
				// @ts-ignore
				delete clonedI.updatedAt;
				return clonedI;
			});
			// @ts-ignore
			delete upcoming.id;
			// @ts-ignore
			delete upcoming.createdAt;
			// @ts-ignore
			delete upcoming.updatedAt;
			// @ts-ignore
			delete upcoming.paymentData;
			// @ts-ignore
			delete upcoming.failureMessage;
			// @ts-ignore
			delete upcoming.payDate;
			// @ts-ignore
			delete upcoming.processDate;
			//@ts-ignore
			delete upcoming.refundDate;

			upcoming.invoiceStatus = upcomingInvoiceStatus;
			upcoming.securityDepositStatus = upcomingInvoiceStatus;
			const upcomingDateForOfflineInvoice = dayjs(invoice.processDate).add(1, 'month');
			upcoming.processDate = upcomingDateForOfflineInvoice.add(1, 'hour').toString();


			// @ts-ignore
			upcoming.payDate = null;
			upcoming.paidAmount = 0;
			upcoming.paid = false;

			await this.invoiceRepository.save(upcoming);
		} catch (e) {
			loggerHelper.error(e);
			throw e;
		}
	}

	/**
	 * 1. Esli podpiska pod DD - to crediti ee mozhno usatj vo vsech public spaces (vsech brandov) + v members only spaces DD
	 * 2. Esli estj 2e podpiski dd - odna team odna ne team, to crediti i activity idut pod team membership. Esli zakonchilisj tam crediti, to crediti berutsa iz sledujushej podpiski i etot activity uzhe NE otnositsa k teamu
	 * 3. Esli estj neskoljko podpisok team ot DD - to crediti berutsa ot toj chto ranjshe bila u usera i etot activity idet k etomu teamu
	 * 4. Esli podpiska, team ili net, NE pod brandom DD - to creditami mozhno poljzovatsa TOLJKO v spacach etogo branda (members only ili public ne vazhno, NO toljko etogo branda)
	 * 5. Esli estj odna podpiska dd a odna ne dd (skazhem branda A) - to snachala po toj chto dd crediti i team (esli zabookan space kotorij mozhno usatj v oboich - skazhem public branda A, a members only branda A pojdet pod podpisku branda A a ne dd kanesh)
	 */
	async getTeamAndSubForSpace(
		space: SpaceEntity,
		subs: SubscriptionEntity[] | undefined
	): Promise<[SubscriptionEntity | undefined, TeamEntity | undefined]> {
		if (!subs) return [undefined, undefined];
		const createdAtSort = (a: SubscriptionEntity, b: SubscriptionEntity) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf();

		const getSubGivenCredits = (sub: SubscriptionEntity): number => {
			const credits = sub.creditHours?.find(
				(ch: SubscriptionCreditHoursEntity) =>
					ch.type === (space.spaceType.logicType === SpaceTypeLogicType.MINUTELY ? 'check-in' : 'conference')
			);
			if (!credits) return 0;
			console.log('returning credits '+ String(credits));
			return credits.given;
		};

		// sort by creation date
		subs.sort(createdAtSort);
		const ddBrand = await this.brandRepository.findOneOrFail({ where: { name: DEFAULT_BRAND_NAME } });
		const ddSubs = subs.filter((s: SubscriptionEntity) => s.brandId === ddBrand.id);
		if (
			(space.packageShow === PackageShow.PUBLIC || (space.venue.brandId === ddBrand.id && space.packageShow === PackageShow.MEMBERS_ONLY)) &&
			ddSubs.length > 0
		) {
			// teams with credits
			const teamSubs = ddSubs.filter((s: SubscriptionEntity) => s.teams?.length && getSubGivenCredits(s) > 0);
			teamSubs.sort(createdAtSort);

			if (teamSubs.length) return [teamSubs[0], teamSubs[0].teams?.length ? teamSubs[0].teams[0] : undefined];

			// no teams with credits - use dd sub
			const ddSubsWithCredits = ddSubs.filter((s: SubscriptionEntity) => !s.teams?.length && getSubGivenCredits(s) > 0);
			ddSubsWithCredits.sort(createdAtSort);

			if (ddSubsWithCredits.length)
				return [ddSubsWithCredits[0], ddSubsWithCredits[0].teams?.length ? ddSubsWithCredits[0].teams[0] : undefined];

			// no credits and no teams
			const subsWOCreditsAndNoTeam = ddSubs.filter((s) => !getSubGivenCredits(s) && !s.teams?.length);
			subsWOCreditsAndNoTeam.sort(createdAtSort);

			return [subsWOCreditsAndNoTeam[0], subsWOCreditsAndNoTeam[0].teams?.length ? subsWOCreditsAndNoTeam[0].teams[0] : undefined];
		}

		// no dd subs or space is other than public or ss members only
		const spaceBrandSubs = subs.filter((s: SubscriptionEntity) => s.brandId !== ddBrand.id);
		spaceBrandSubs.sort(createdAtSort);

		if (spaceBrandSubs.length) return [spaceBrandSubs[0], spaceBrandSubs[0].teams?.length ? spaceBrandSubs[0].teams[0] : undefined];
		return [undefined, undefined];
	}

	/**
	 * Creates new invoice
	 * @param {CreateInvoiceDto} data - data from HTTP request
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @return {Promise<InvoiceEntity>} Returns saved invoice with items or error.
	 */
	async create(data: CreateInvoiceDto, callFromsubscriptionservice:boolean, requestedByUser?: UserEntity | undefined): Promise<InvoiceEntity> {
		try {
			const invoiceStatusRepo = MainDataSource.getRepository(InvoiceStatusEntity);
			const securityDepositStatusRepo = MainDataSource.getRepository(SecurityDepositStatusEntity);

			const userService = new UserService();

			const space = await this.spaceRepository.findOne({
				where: { id: Number(data.spaceId) },
				relations: [
					'venue',
					'packageBrands',
					'packageVenueTypes',
					'packageVenues',
					'packageSpaceTypes',
					'amenities',
					'amenities.amenity',
					'spaceType',
					'creditHours',
					'venue.brand',
					'packageSubCategories',
				],
			});
			/**
			 * Temporary fix for dayjs tz lib.
			 * TODO: update dayjs lib when fix will be announced
			 */
			if (data.userTz === 'Europe/Kyiv') data.userTz = 'Europe/Kiev';

			/**
			 * Custom invoice from admin without space
			 */
			if (!data.spaceId) {
				const user = await this.userRepository.findOneOrFail({ where: { id: Number(data.userId) }, select: { id: true, brandId: true } });

				let subTotal = 0;
				let subTax = 0;

				const invoiceItems: InvoiceItemEntity[] = [];

				if (data.items) {
					data.items.forEach((item: CreateInvoiceItemDto) => {
						const newItem = this.invoiceItemRepository.create();

						const aPrice = item.price ? item.price : 0;

						const aTax = item.tax ? (aPrice * item.tax) / 100 : 0;

						const aRealPrice = getPriceByChargeType(aPrice, newItem.chargeType ? newItem.chargeType : '');

						newItem.name = item.name !== '' ? item.name : item.invoiceItemType;
						newItem.price = Number(aPrice);
						newItem.price2 = Number(aRealPrice);
						newItem.tax = aTax;
						newItem.dateBought = (data.userTz ? dayjs().tz(data.userTz) : dayjs()).toDate();
						newItem.paidAmount = 0;
						newItem.refunded = false;
						newItem.createdById = Number(data.createdById || data.userId);
						newItem.updatedById = Number(data.createdById || data.userId);
						newItem.paid = false;
						newItem.chargeType = item.chargeType;
						newItem.invoiceItemType = item.invoiceItemType;
						newItem.quantity = 1;
						newItem.creditHours = 0;
						newItem.amenityHoursIncluded = 0;

						invoiceItems.push(newItem);
						subTotal += aRealPrice;
						subTax += aTax;
					});
				}

				const query = this.invoiceRepository.createQueryBuilder('invoice');
				query.select('MAX(invoice.invoiceNumber)', 'max');
				const lastInvoiceNumberQ = await query.getRawOne();
				const invoice: InvoiceEntity = this.invoiceRepository.create();
				invoice.invoiceNumber = lastInvoiceNumberQ.max + 1;
				invoice.subTotal = Number(subTotal);
				invoice.tax = subTax;
				invoice.userId = Number(data.userId);
				invoice.createdById = Number(data.createdById || data.userId);
				invoice.updatedById = Number(data.createdById || data.userId);
				invoice.brandId = user.brandId;
				invoice.paidAmount = 0;
				invoice.refund = false;
				invoice.currency = DEFAULT_CURRENCY.code;
				invoice.paid = false;
				invoice.items = invoiceItems;
				invoice.invoiceStatus = (await this._getStatusByName('New')) || undefined;
				invoice.securityDepositStatus = (await this._getSecurityStatusByName('New')) || undefined;

				const { id: savedInvoiceId } = await this.invoiceRepository.save(invoice);

				const savedInvoice: InvoiceEntity | null = await this.invoiceRepository.findOne({
					where: { id: savedInvoiceId },
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
						'space.packageSubCategories',
						'space.spaceType',
						'space.creditHours',
						'items',
						'venue',
						'venue.logo',
						'venue.photos',
						'venue.createdBy',
						'invoiceStatus',
						'reservation',
					],
				});

				if (!savedInvoice) {
					throw new ErrorResponse({ message: 'Invoice saving failed' });
				}

				try {
					const charged = await this.processPayment(savedInvoice, data, requestedByUser, false);
					if (!charged) throw new ErrorResponse({ message: savedInvoice?.failureMessage || 'Error occurred' });
				} catch (e) {
					loggerHelper.error(e);
					throw e;
				}
				return savedInvoice;
			}

			const { spaceId, userId, createdById } = data;

			if (!spaceId) {
				loggerHelper.error('Error creating invoice with empty space ID', data);
				throw new NotFoundErrorResp({ message: 'Not found Space' });
			}
			const invoiceStatusList = await invoiceStatusRepo.find();
			const securityDepositStatusList = await securityDepositStatusRepo.find();

			if (!space) {
				loggerHelper.error('Error creating invoice for space that not exist', data);
				throw new NotFoundErrorResp({ message: 'Not found Space' });
			}

			if (space.status !== SpaceStatus.PUBLISH) {
				loggerHelper.error('Error creating invoice for not publish space', data);
				throw new ForbiddenResponse({ message: 'Space is not publish' });
			}

			const userSubscriptions = await UserService._getSubscriptionsByUserId(userId);

			// check if user already has this subscription or membership and invoice created by admin
			if (
				userSubscriptions.filter(
					(s) => s.spaceId === space.id && String(s.userId) === String(userId) && String(userId) !== String(createdById) && s.isOngoing
				).length > 0
			) {
				throw new ForbiddenResponse({ message: 'Cannot add a subscription that user already has' });
			}

			const [userSub, userTeam] = await this.getTeamAndSubForSpace(space, userSubscriptions);

			const invoiceItems: InvoiceItemEntity[] = [];

			const item: InvoiceItemEntity = await this._createSpaceItem(space, data, false, requestedByUser);
			invoiceItems.push(item);

			if (space.securityDeposit && space.securityDepositPrice) {
				const depositItem = this._createDepositItem(space, data);
				invoiceItems.push(depositItem);
			}

			space.amenities.forEach((amenity: SpaceAmenityEntity) => {
				const amenityItem = this._createAmenityItem(amenity, space, data);
				invoiceItems.push(amenityItem);
			});

			const query = this.invoiceRepository.createQueryBuilder('invoice');
			query.select('MAX(invoice.invoiceNumber)', 'max');
			const lastInvoiceNumberQ = await query.getRawOne();
			const invoice: InvoiceEntity = this.invoiceRepository.create();
			invoice.invoiceNumber = lastInvoiceNumberQ.max + 1;
			invoice.subTotal = invoiceItems[0].price2;
			invoice.tax = invoiceItems.map((i) => (i.tax !== 0 ? (i.price2 * i.tax) / 100 : 0)).reduce((a, b) => a + b, 0);
			invoice.userId = Number(userId);
			invoice.createdById = Number(createdById || userId);
			invoice.updatedById = Number(createdById || userId);
			invoice.venueId = space.venueId;
			invoice.venue = space.venue;
			invoice.brandId = space.venue.brandId;
			invoice.subscriptionId = userSub ? userSub.id : undefined;
			invoice.teamId = userTeam ? userTeam.id : undefined;
			invoice.brand = space.venue.brand;
			invoice.spaceId = Number(spaceId);
			invoice.space = space;
			invoice.currency = typeof space.venue.currency === 'undefined' ? DEFAULT_CURRENCY.code : space.venue.currency;
			invoice.paidAmount = 0;
			invoice.refund = false;
			invoice.paid = false;
			invoice.items = invoiceItems;
			const isInstantlyBookableEnabled = await this.features.isEnabled(FeatureFlag.instantlyBookableFeature);

			if(space?.instantlyBookable === false && isInstantlyBookableEnabled)
					{
						invoice.instantlyBookableRequested = true;
						invoice.reminderSend = false;
					}

			const newInvoiceStatus = invoiceStatusList.find((invStatus: InvoiceStatusEntity) => invStatus.name === 'New');
			if (typeof newInvoiceStatus !== 'undefined') {
				invoice.invoiceStatusId = newInvoiceStatus.id;
			}

			const newSecurityDepositStatus = securityDepositStatusList.find((invStatus: SecurityDepositStatusEntity) => invStatus.name === 'New');
			if (typeof newSecurityDepositStatus !== 'undefined') {
				invoice.securityDepositStatusId = newSecurityDepositStatus.id;
			}

			const { id: savedInvoiceId } = await this.invoiceRepository.save(invoice);

			const savedInvoice: InvoiceEntity | null = await this.invoiceRepository.findOne({
				where: {
					id: savedInvoiceId,
				},
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
					'space.packageSubCategories',
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
				],
			});

			if (!savedInvoice) {
				loggerHelper.error('Invoice saving failed', { invoice, data });
				throw new ErrorResponse({ message: 'Invoice saving failed' });
			}

			try {
					const charged = await this.processPayment(savedInvoice, data, requestedByUser, false);
					if (!charged) throw new ErrorResponse({ message: savedInvoice?.failureMessage || 'Error occurred' });
					
                  } catch (e) {
                loggerHelper.error(e);
                throw e;
            }

			//td-13

			   if(!callFromsubscriptionservice)// && space?.spaceType?.logicType==SpaceTypeLogicType.MONTHLY)
			   {
				await this._deductSpaceQuantity(space);
			}

			
		   
			if ([SpaceTypeLogicType.HOURLY, SpaceTypeLogicType.MINUTELY].includes(space.spaceType.logicType))
				await userService._saveUserCredits(
					userId,
					savedInvoice.id,
					(space.spaceType.logicType === SpaceTypeLogicType.MINUTELY ? 'check-in' : 'conference') as HoursType
				);
				if(requestedByUser && invoice.instantlyBookableRequested && await this.features.isEnabled(FeatureFlag.instantlyBookableFeature))
					setTimeout(() => this.sendHostApprovalSMS(invoice, requestedByUser), 5000);
				
			return savedInvoice;
		} catch (e) {
			loggerHelper.error('Error creating invoice (catch block)');
			loggerHelper.error(JSON.stringify(data));
			loggerHelper.error(e);
			throw e;
		}
	}


	getMyBookingURL = (): string => {
		return `${process.env.SMS_BOOKING_URL}`;
	};
	getActivityURL = (): string => {
		return `${process.env.SMS_ACTIVITY_URL}`;
	};

	async sendHostApprovalSMS( invoice: any, requestedByUser: UserEntity) {
		const existingConversation = await MainDataSource.getRepository(InstantlyBookableConversationEntity).findOne({
			where: { userId:invoice.userId, spaceId: invoice.spaceId, isResponded: IsNull(), isRequested: false },
			relations: ['participants'],
		});

		console.log("Host Approval (sendHostApprovalSMS) : existingConversation"+ existingConversation?.id + "proxy:"+existingConversation?.proxyNumber)

		const venue = await MainDataSource.getRepository(VenueEntity).findOneOrFail({
			where: { id:invoice.venueId },
			relations: ['accessCustomData']
		});

		const space = await MainDataSource.getRepository(SpaceEntity).findOneOrFail({
			where: { id:invoice.spaceId },
		});

		invoice = await MainDataSource.getRepository(InvoiceEntity).findOneOrFail({
			where: { id:invoice.id },
		});


		const reservation = await MainDataSource.getRepository(ReservationEntity).findOneOrFail({
			where: { invoiceId:invoice.id },
		});



		const isUSA = (reservation.tzUser || reservation.tzLocation).indexOf('America') !== -1;
		const timeFormat = isUSA ? 'hh:mm A' : 'HH:mm';

		const getReservTime = (time: string) =>
			dayjs(time)
				.tz(reservation.tzLocation)
				.format(`D MMMM YYYY ${timeFormat}`);

				invoice.reservation = {
			hoursFrom: getReservTime(reservation.hoursFrom),
			hoursTo: reservation.hoursTo ? getReservTime(reservation.hoursTo) : 'In progress',
			bookedAt: dayjs(reservation.bookedAt)
				.tz(reservation.tzLocation)
				.format('ddd MMM D YYYY'),
			chargeType: reservation.chargeType,
			userTz: reservation.tzUser || reservation.tzLocation,
		};

		if(existingConversation && invoice.reservation && invoice.reservation.hoursTo)
		{
		invoice.invoiceStatus = (await this._getStatusByName('Pending')) || undefined;
		const isPhoneNumberServiceEnabled = await this.features.isEnabled(FeatureFlag.isPhoneNumberServiceEnabled);
		await this.invoiceRepository.save(invoice);
		await MainDataSource.getRepository(InstantlyBookableConversationEntity).save({	id: existingConversation.id, invoiceId:invoice.id, isRequested: true });
		await sendHostRequestSMS({
			existingConversation: existingConversation,
			Venue: venue,
			bookedAt : dayjs(invoice.reservation?.bookedAt)
				.tz(invoice.reservation?.tzLocation)
				.format('ddd MMM D YYYY'),
			bookedForDate : dayjs(invoice.reservation.hoursFrom)
			.format('ddd MMM D YYYY'),
			bookedForDay : dayjs(invoice.reservation.hoursFrom)
			.format('dddd'),
			hoursFrom: (invoice.reservation.hoursFrom),
			hoursTo: (invoice.reservation.hoursTo),
			Space: space,
			invoice: invoice,
			UserName: requestedByUser.username,
			requestedByUser: requestedByUser,
			bookingType: space.chargeType,
		}, isPhoneNumberServiceEnabled);
	}
	}

	/**
	 * Create check in invoice
	 * @param {string} spaceId - drop-in space id
	 * @param {string} userId - issued to user id
	 * @param {string | null} createdById - in case we create checkin as admin
	 * @param {string} userTz - user location timezone
	 * @return {Promise<InvoiceEntity | Error>} Returns saved invoice with items or error.
	 */
	async createCheckIn({ spaceId, userId, createdById, userTz }: CheckInDto): Promise<InvoiceEntity | Error> {
		const userSubscriptions = await UserService._getSubscriptionsByUserId(userId);
		const user = await this.userRepository.findOneOrFail({ where: { id: +userId }, relations: { brand: true } });
		const space = await this.spaceRepository.findOneOrFail({
			where: { id: +spaceId },
			relations: ['venue', 'spaceType', 'reservation', 'venue.accessCustomData'],
		});

		const startDate = dayjs().tz(userTz || space.venue.tzId);

		const ongoingReservations = space.reservation.filter(
			(reserv: ReservationEntity) =>
				!reserv.hoursTo && !!reserv.hoursFrom && reserv.userId === Number(userId) && reserv.status === ReservationStatus.ACTIVE
		);

		if (ongoingReservations.length) throw new ForbiddenResponse({ message: 'Already have ongoing reservation.' });

		const [userSub, userTeam] = await this.getTeamAndSubForSpace(space, userSubscriptions);

		let closeTime = dayjs.tz(space.venue.accessHoursTo, 'HH:mm:ss', space.venue.tzId).tz(userTz || space.venue.tzId);
		let openTime = dayjs.tz(space.venue.accessHoursFrom, 'HH:mm:ss', space.venue.tzId).tz(userTz || space.venue.tzId);
		if (closeTime.isSameOrBefore(openTime)) openTime = openTime.subtract(1, 'd');

		const day = startDate.format('dddd');

		let isClosedInit = !startDate.isBetween(openTime, closeTime);

		if (space.venue.accessCustom) {
			const accessData = space.venue.accessCustomData;
			const todayAccess = accessData.find((acd: AccessCustomDataEntity) => acd.weekday === day);

			if (todayAccess) {
				closeTime = dayjs.tz(todayAccess?.accessHoursTo as string, 'HH:mm:ss', space.venue.tzId).tz(userTz || space.venue.tzId);
				openTime = dayjs.tz(todayAccess?.accessHoursFrom as string, 'HH:mm:ss', space.venue.tzId).tz(userTz || space.venue.tzId);

				if (closeTime.isSameOrBefore(openTime)) closeTime = closeTime.add(1, 'd');
				if (!todayAccess.open) {
					isClosedInit = true;
				} else {
					isClosedInit = !startDate.isBetween(openTime, closeTime);
				}
			}
		}

		const is247Access = await isAccess247(userId, space.venue.brandId);
		if (isClosedInit && !is247Access) throw new ForbiddenResponse({ message: "Can't check-in.Space is closed now." });

		const invoiceItem = this.invoiceItemRepository.create();
		invoiceItem.name = 'Check-in';
		invoiceItem.price = Number(space.price);
		invoiceItem.price2 = 0;
		invoiceItem.paidAmount = 0;
		invoiceItem.quantity = 0;
		invoiceItem.creditHours = 0;
		invoiceItem.spaceId = space.id;
		invoiceItem.venueId = space.venueId;
		invoiceItem.createdById = Number(createdById || userId);
		invoiceItem.refunded = false;
		invoiceItem.paid = false;
		invoiceItem.invoiceItemType = InvoiceItemType.SPACE;
		invoiceItem.chargeType = space.chargeType;
		await this.invoiceItemRepository.save(invoiceItem);

		const query = this.invoiceRepository.createQueryBuilder('invoice');
		query.select('MAX(invoice.invoiceNumber)', 'max');
		const lastInvoiceNumberQ = await query.getRawOne();
		const invoice: InvoiceEntity = this.invoiceRepository.create();
		invoice.invoiceNumber = lastInvoiceNumberQ.max + 1;
		invoice.userId = Number(userId);
		invoice.paidAmount = 0;
		invoice.spaceId = space.id;
		invoice.brandId = user.brandId;
		invoice.subscriptionId = userSub ? userSub.id : undefined;
		invoice.teamId = userTeam ? userTeam.id : undefined;
		invoice.currency = typeof space.venue.currency === 'undefined' ? DEFAULT_CURRENCY.code : space.venue.currency;
		invoice.venueId = space.venueId;
		invoice.createdById = Number(createdById || userId);
		invoice.updatedById = Number(createdById || userId);
		invoice.items = [invoiceItem];
		invoice.invoiceStatus = (await this._getStatusByName('Upcoming-Hours')) || undefined;
		invoice.securityDepositStatus = (await this._getStatusByName('Upcoming-Hours')) || undefined;

		let reservation = this.reservationRepository.create();
		reservation.userId = Number(userId);
		reservation.spaceId = space.id;
		reservation.venueId = space.venueId;
		reservation.bookedAt = (userTz ? dayjs().tz(userTz) : dayjs()).format() as unknown as Date;
		reservation.createdById = invoice.createdById;
		reservation.updatedById = invoice.updatedById;
		reservation.hoursFrom = startDate.format();
		reservation.price = 0;
		reservation.tzLocation = space.venue.tzId;
		reservation.isCheckin = true;
		reservation.status = ReservationStatus.ACTIVE;
		reservation.chargeType = space.chargeType;
		reservation.tzUser = userTz || space.venue.tzId;

		reservation = await this.reservationRepository.save(reservation);

		invoice.reservationId = reservation.id;
		invoiceItem.reservationId = reservation.id;
		invoiceItem.createdById = invoice.createdById;
		invoiceItem.updatedById = invoice.updatedById;

		await this.invoiceItemRepository.save(invoiceItem);
		const savedInvoice = await this.invoiceRepository.save(invoice);
		reservation.invoiceId = savedInvoice.id;
		await this.reservationRepository.save(reservation);

		savedInvoice.reservation = reservation;

		const { brand } = user;

		if (brand!.chargeCustomer) {
			let [stripe, customerId, payUser] = await useStripe(+userId);

			try {
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
								[stripe, customerId, payUser] = await useStripe(+team.teamLeadId);
								const customerLead: Stripe.Customer = (await stripe.customers.retrieve(customerId)) as Stripe.Customer;
								if (!customerLead.default_source) {
									loggerHelper.error('user has no default payment method!', { userId, customerId, payUser });
									throw new ForbiddenResponse({ message: 'No default payment method!' });
								}
								
							}
					}

					loggerHelper.error('user has no default payment method!', { userId, customerId, payUser });
					throw new ForbiddenResponse({ message: 'No default payment method!' });
				}

				const chargeResult: Stripe.PaymentIntent = await stripe.paymentIntents.create({
					amount: Math.round(AUTO_CHECKOUT_DAYS * space.price * 100),
					currency: savedInvoice.currency,
					confirm: true,
					customer: customerId,
					description: `Invoice #${savedInvoice.invoiceNumber}`,
					capture_method: 'manual',
					payment_method: String(customer.default_source),
					receipt_email: user.email,
					metadata: {
						invoiceId: savedInvoice.id,
						userId: savedInvoice.userId,
						reservationId: savedInvoice.reservationId,
						env: NODE_ENV,
						serverUrl: SERVER_URL,
					},
				});

				const stripeInvoiceId =
					chargeResult.invoice && typeof chargeResult.invoice !== 'string' ? chargeResult.invoice.id : chargeResult.invoice;

				await this.invoiceProviderDataRepository.save(
					this.invoiceProviderDataRepository.create({
						providerInvoiceId: String(stripeInvoiceId),
						provider: PaymentProvider.STRIPE,
						invoiceId: savedInvoice.id,
					})
				);

				const payDataRepo = MainDataSource.getRepository(PaymentDataEntity);
				const paymentData: PaymentDataEntity = payDataRepo.create();
				paymentData.provider = PaymentProvider.STRIPE;
				paymentData.refund = false;
				paymentData.securityRefund = false;
				paymentData.paid = false;
				paymentData.data = chargeResult;
				paymentData.invoiceId = savedInvoice.id;
				paymentData.userId = payUser.id;
				paymentData.amount = Number(chargeResult.amount) / 100;
				savedInvoice.paymentData = [paymentData];
				savedInvoice.invoiceStatus = (await this._getStatusByName('New')) || undefined;
				savedInvoice.securityDepositStatus = (await this._getSecurityStatusByName('New')) || undefined;
				await this.invoiceRepository.save(savedInvoice);
			} catch (e) {
				loggerHelper.error('STRIPE PAYMENT FAILED - ', e);
				const { message } = e as Error;
				const paymentFailedStatus = await this._getStatusByName('Payment Failed');
				savedInvoice.paidAmount = 0;
				savedInvoice.paid = false;
				savedInvoice.failureMessage = message;
				savedInvoice.invoiceStatus = paymentFailedStatus || undefined;
				await this.invoiceRepository.save(savedInvoice);
				await this._sendEmail(savedInvoice.id, InvoiceEmailTypes.CHECK_IN);
				throw e;
			}
		}
		await this._sendEmail(savedInvoice.id, InvoiceEmailTypes.CHECK_IN);
		return savedInvoice;
	}

	/**
	 * Close user drop-in and returns updated invoice.
	 * @param {number} reservationId - Drop-in reservation ID
	 * @param {string?} endTime - Drop-in end time
	 * @param {boolean?} isCron
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @return {Promise<InvoiceEntity | Error | undefined>} Returns saved invoice with items or error.
	 */
	async finishCheckIn(
		{ reservationId, endTime, isCron = false }: CheckOutDto,
		requestedByUser?: UserEntity | undefined
	): Promise<InvoiceEntity | Error | undefined> {
		const userService = new UserService();

		// TODO: optimise finds
		const reservation = await this.reservationRepository.findOneOrFail({ where: { id: reservationId } });

		const invoice = await this.invoiceRepository.findOneOrFail({
			where: { id: reservation.invoiceId! },
			relations: [
				'reservation',
				'space',
				'items',
				'space.photos',
				'space.spaceType',
				'space.creditHours',
				'venue',
				'venue.logo',
				'venue.photos',
				'venue.createdBy',
				'invoiceStatus',
				'paymentData',
			],
		});

		const { space } = invoice;

		const endDate =
			endTime ||
			dayjs()
				.tz(reservation.tzUser || reservation.tzLocation)
				.format();

		const item = invoice.items.find((thisItem: InvoiceItemEntity) => thisItem.reservationId === reservation.id);

		if (typeof item === 'undefined') throw new NotFoundErrorResp({ message: 'Not found reservation' });

		// if (endTime) {
		// 	const duration = dayjs.duration(dayjs(endTime).diff(dayjs(reservation.hoursFrom))).asMinutes();
		// 	item.quantity = Number((duration / 60).toFixed(4));
		// } else {
		// 	item.quantity = _calcItemHours({ startDate: reservation.hoursFrom, endDate, space });
		// }
		item.quantity = _calcItemHours({ startDate: reservation.hoursFrom, endDate: endTime || endDate, space });

		let timePrice = Number((item.quantity * space.price).toFixed(3));

		if (!space.notAllowCredit && item.quantity > 0) {
			const credits = await userService._calcSpaceHours(invoice.userId, [space.id], item.quantity, requestedByUser);
			if (Array.isArray(credits)) {
				item.creditHours = credits[0].creditHours;
				timePrice = Number((credits[0].billable * space.price).toFixed(3));
			}
		}

		item.price2 = timePrice;
		invoice.subTotal = timePrice;
		reservation.price = timePrice;
		reservation.hoursTo = endDate;

		const paidStatus = await this._getStatusByName('Paid');
		const securityAmountPaidStatus = await this._getSecurityStatusByName('Paid');
		const failedStatus = await this._getStatusByName('Payment Failed');
		invoice.refund = false;

		if (invoice.paymentData && invoice.paymentData.length > 0) {
			// search not payed invoice
			let notPayedData = invoice.paymentData.find((pd: PaymentDataEntity) => !pd.paid && !pd.refund);
			if (typeof notPayedData === 'undefined' || !notPayedData.data || !notPayedData.data.id)
				throw new NotFoundErrorResp({ message: `Invoice ID${invoice.id}: Not found payment data or already paid` });

			const [stripe] = await useStripe(invoice.userId);

			const amount = Number((timePrice * 100).toFixed());

			const doRefund = async (notPayedDataInput: PaymentDataEntity): Promise<PaymentDataEntity> => {
				const notPayedDataClone = notPayedDataInput;
				try {
					// cancel charge if user used his credit hours
					const refundResult = await stripe.paymentIntents.cancel(String(notPayedDataClone.data.id));

					if (refundResult.status === 'canceled') {
						notPayedDataClone.data = refundResult;
						notPayedDataClone.refund = true;
						notPayedDataClone.securityRefund = true;
						notPayedDataClone.amount = amount / 100;
						invoice.paid = true;
						invoice.paidAmount = amount / 100;
						invoice.payDate = (reservation.tzUser ? dayjs().tz(reservation.tzUser) : dayjs()).format();
						invoice.processDate = reservation.tzUser ? dayjs().tz(reservation.tzUser).format() : dayjs().format();

						const refundObj = MainDataSource.getRepository(RefundEntity).create({
							createdById: invoice.updatedById,
							note: `DropIn money difference on Invoice #${invoice.invoiceNumber}`,
							amount: refundResult.amount,
							returnDate: new Date(),
							userId: invoice.userId,
							invoiceId: invoice.id,
							createdAt: new Date(),
							updatedAt: new Date(),
						});

						const newRefundObj = await MainDataSource.getRepository(RefundEntity).save(refundObj);

						const refundData = MainDataSource.getRepository(RefundDataEntity).create({
							data: refundResult,
							userId: invoice.userId,
							provider: PaymentProvider.STRIPE,
							invoiceId: invoice.id,
							refundId: newRefundObj.id,
							refund: refundResult && refundResult.status === 'canceled',
							amount: refundResult.amount,
						});

						await MainDataSource.getRepository(RefundDataEntity).save(refundData);
					} else {
						invoice.paid = false;
						invoice.invoiceStatus = failedStatus || undefined;
						invoice.failureMessage = String(refundResult.status);
						notPayedDataClone.refund = false;
						notPayedDataClone.securityRefund = false;
						notPayedDataClone.paid = false;
						notPayedDataClone.amount = amount / 100;
					}
				} catch (e) {
					const { message } = e as Error;
					invoice.paid = false;
					invoice.invoiceStatus = failedStatus || undefined;
					invoice.failureMessage = message;
					notPayedDataClone.refund = false;
					notPayedDataClone.securityRefund = false;
					notPayedDataClone.paid = false;
					notPayedDataClone.amount = amount / 100;
				}
				return notPayedDataClone;
			};

			if (amount > 0) {
				try {
					const chargeRes: Stripe.PaymentIntent = await stripe.paymentIntents.capture(notPayedData.data.id, {
						amount_to_capture: amount,
					});
					// loggerHelper.error('checkout payment object - ', chargeRes);

					if (chargeRes.status === 'succeeded') {
						notPayedData.data = chargeRes;
						notPayedData.paid = true;
						notPayedData.amount = amount / 100;
						invoice.invoiceStatus = paidStatus || undefined;
						invoice.securityDepositStatus = securityAmountPaidStatus || undefined;
						invoice.paid = true;
						invoice.payDate = reservation.tzUser ? dayjs().tz(reservation.tzUser).format() : dayjs().format();
						invoice.paidAmount = amount / 100;
						invoice.processDate = reservation.tzUser ? dayjs().tz(reservation.tzUser).format() : dayjs().format();
					} else {
						invoice.paid = false;
						invoice.invoiceStatus = failedStatus || undefined;
						invoice.failureMessage = String(chargeRes.status);
						notPayedData.refund = false;
						notPayedData.securityRefund = false;
						notPayedData.paid = false;
					}
				} catch (e) {
					loggerHelper.error('checkout payment error - ', e);
					// @ts-ignore
					if (['amount_too_small'].includes(e.code)) {
						notPayedData = await doRefund(notPayedData);
					} else {
						const { message } = e as Error;
						invoice.paid = false;
						invoice.failureMessage = message;
						invoice.invoiceStatus = failedStatus || undefined;
						notPayedData.refund = false;
						notPayedData.securityRefund = false;
						notPayedData.paid = false;
					}
				}
			} else {
				invoice.invoiceStatus = paidStatus || undefined;
				invoice.securityDepositStatus = securityAmountPaidStatus || undefined;
				notPayedData = await doRefund(notPayedData);
			}
			await MainDataSource.getRepository(PaymentDataEntity).save(notPayedData);
		} else {
			// for free spaces or where price is 0
			invoice.invoiceStatus = paidStatus || undefined;
			invoice.securityDepositStatus = securityAmountPaidStatus || undefined;
			invoice.paid = true;
			invoice.payDate = (reservation.tzUser ? dayjs().tz(reservation.tzUser) : dayjs()).format();
			invoice.paidAmount = timePrice;
		}

		reservation.status = ReservationStatus.FINISHED;
		await this.reservationRepository.save(reservation);
		await this.invoiceItemRepository.save(item);
		await this._deductSpaceQuantity(space);
		await userService._saveUserCredits(
			invoice.userId,
			reservation.invoiceId!,
			(space.spaceType.logicType === SpaceTypeLogicType.MINUTELY ? 'check-in' : 'conference') as HoursType,
			isCron
		);
		await this.invoiceRepository.save(invoice);
		await this._sendEmail(invoice.id, InvoiceEmailTypes.CHECK_OUT);

		Socket.connection().sendEventToUser(String(reservation.userId), SocketEventsType.DROPIN_FINISH_CRON, {
			spaceId: reservation.spaceId,
			message: "You've been checked-out from space!",
		});

		return { ...invoice, reservation };
	}

	/**
	 * Return single invoice object with relations
	 * @param {string} id - Invoice ID
	 * @return {Promise<InvoiceEntity | undefined>} Returns invoice object or undefined
	 */
	async single(id: number): Promise<SingleInvoiceWebResp | undefined> {
		let invoice: SingleInvoiceWebResp = await this.invoiceRepository
			.createQueryBuilder('i')
			.addSelect('i.createdAt')
			.leftJoinAndSelect('i.reservation', 'reservation')
			.leftJoinAndSelect('i.providerData', 'providerData')
			.leftJoinAndSelect('i.subscription', 'subscription')
			.leftJoinAndSelect('i.items', 'items')
			.leftJoinAndSelect('i.issuedTo', 'issuedTo')
			.leftJoinAndSelect('i.invoiceStatus', 'invoiceStatus')
			.leftJoinAndSelect('i.space', 'space')
			.leftJoinAndSelect('space.photos', 'spacePhotos')
			.leftJoinAndSelect('space.spaceType', 'spaceType')
			.leftJoinAndSelect('i.venue', 'venue')
			.leftJoinAndSelect('venue.photos', 'venuePhotos')
			.leftJoinAndSelect('venue.venueAdmins', 'venueAdmins')
			.leftJoinAndSelect('venueAdmins.photo', 'photo')
			.leftJoinAndSelect('i.paymentData', 'paymentData')
			.leftJoinAndSelect('i.paymentMode', 'paymentMode')
			.leftJoinAndSelect('i.refundData', 'refundData')
			.leftJoinAndSelect('i.createdBy', 'createdBy')
			.leftJoinAndSelect('reservation.reservedTo', 'reservedTo')
			.leftJoinAndSelect('reservation.createdBy', 'resCreatedBy')
			.where('i.id = :id', { id })
			.getOneOrFail();

		invoice = await this._updateObjWithStripeInvoice(invoice);
		const reservedToUser = await MainDataSource.getRepository(UserEntity).findOne({
			where: { id: invoice.reservation?.reservedTo?.id },
			relations: ['photo'],
			cache: true,
		})
		
		if (reservedToUser && invoice.reservation && invoice.reservation?.reservedTo) invoice.reservation.reservedTo.photo = reservedToUser.photo;
		return invoice;
	}
	async singleWithoutUpdate(id: number): Promise<SingleInvoiceWebResp | undefined> {
		let invoice: SingleInvoiceWebResp = await this.invoiceRepository
			.createQueryBuilder('i')
			.addSelect('i.createdAt')
			.leftJoinAndSelect('i.reservation', 'reservation')
			.leftJoinAndSelect('i.providerData', 'providerData')
			.leftJoinAndSelect('i.subscription', 'subscription')
			.leftJoinAndSelect('i.items', 'items')
			.leftJoinAndSelect('i.issuedTo', 'issuedTo')
			.leftJoinAndSelect('i.invoiceStatus', 'invoiceStatus')
			.leftJoinAndSelect('i.space', 'space')
			.leftJoinAndSelect('space.photos', 'spacePhotos')
			.leftJoinAndSelect('space.spaceType', 'spaceType')
			.leftJoinAndSelect('i.venue', 'venue')
			.leftJoinAndSelect('venue.photos', 'venuePhotos')
			.leftJoinAndSelect('i.paymentData', 'paymentData')
			.leftJoinAndSelect('i.paymentMode', 'paymentMode')
			.leftJoinAndSelect('i.refundData', 'refundData')
			.leftJoinAndSelect('i.createdBy', 'createdBy')
			.leftJoinAndSelect('reservation.reservedTo', 'reservedTo')
			.leftJoinAndSelect('reservation.createdBy', 'resCreatedBy')
			.where('i.id = :id', { id })
			.getOneOrFail();

		return invoice;
	}

	/**
	 * Return single invoice object with relations
	 * @param {string} id - Invoice ID
	 * @return {Promise<InvoiceEntity>} Returns invoice object or undefined
	 */
	public async getFullInvoice(id: number): Promise<InvoiceEntity> {
		let invoice = await this.invoiceRepository
			.createQueryBuilder('i')
			.where('i.id = :id', { id })
			.addSelect('i.createdAt')
			.leftJoinAndSelect('i.reservation', 'reservation')
			.leftJoinAndSelect('i.items', 'items')
			.leftJoinAndSelect('i.issuedTo', 'issuedTo')
			.leftJoinAndSelect('i.providerData', 'providerData')
			.leftJoinAndSelect('issuedTo.photo', 'issuedToPhoto')
			.leftJoinAndSelect('issuedTo.brand', 'issuedToBrand')
			.leftJoinAndSelect('i.invoiceStatus', 'invoiceStatus')
			.leftJoinAndSelect('i.space', 'space')
			.leftJoinAndSelect('space.photos', 'spacePhotos')
			.leftJoinAndSelect('space.spaceType', 'spaceType')
			.leftJoinAndSelect('space.creditHours', 'creditHours')
			.leftJoinAndSelect('space.amenities', 'amenities')
			.leftJoinAndSelect('amenities.amenity', 'amenity')
			.leftJoinAndSelect('i.venue', 'venue')
			.leftJoinAndSelect('venue.photos', 'venuePhotos')
			.leftJoinAndSelect('venue.logo', 'logo')
			.leftJoinAndSelect('venue.createdBy', 'createdBy')
			.getOneOrFail();

		invoice = await this._updateObjWithStripeInvoice(invoice);
		return invoice;
	}

	async changeStatus(invoiceId: number, updateData: ChangeInvoiceStatusDto, requestedByUser: UserEntity) {
		const invoice = await this.invoiceRepository.findOneOrFail({
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
				'space.packageSubCategories',
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

		if (!invoice._canEdit!(requestedByUser)) throw new ForbiddenResponse();
		const subService = new SubscriptionService();

		const { userId, subTotal, tax, reservationId, paymentData, subscription, reservation, space, invoiceStatus, subscriptionId } = invoice;
		const provider = PaymentProvider.STRIPE;
		const invoicePrice = subTotal + tax;
		const newInvoiceStatus = await MainDataSource.getRepository(InvoiceStatusEntity).findOneOrFail({ where: { id: updateData.statusId } });
		var paymentMode = null;
		if(updateData?.paymentModeId! > 0)
		{
		 paymentMode = await MainDataSource.getRepository(PaymentModeEntity).findOneOrFail({ where: { id: updateData.paymentModeId } });
		}
		if (!updateData.isSecurityRefund) {
			if (invoiceStatus!.name === InvoiceStatus.PAID && newInvoiceStatus.name !== InvoiceStatus.PARTIALLY_REFUNDED && newInvoiceStatus.name !== InvoiceStatus.REFUNDED)
				throw new ForbiddenResponse({ message: "Invoice is Payed. Can't edit!" });

			if (newInvoiceStatus.name === InvoiceStatus.PAID) {
				if(paymentMode === null || paymentMode?.name === "Card")
				{
				const charged = await this.processPayment(
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

					if (charged && space) await this._deductSpaceQuantity(space);
					if (!charged) {
						throw new ForbiddenResponse({ message: 'Payment not charged.' });
					}
					invoice.invoiceStatus = (await this._getStatusByName('New')) || undefined;
					if (invoice.space.chargeType !== ChargeType.MONTHLY) {
						invoice.invoiceStatus = newInvoiceStatus;
					}
				} else {
					invoice.paid = true;
					invoice.invoiceStatus = newInvoiceStatus;
				}

				//Add status of paymnet in security deposit statusdd
				invoice.securityDepositStatusId = Number(updateData.securityDepositStatusId)
				invoice.securityDepositStatus = (await this._getSecurityStatusByName('Paid')) || undefined;
				invoice.paymentMode = updateData.paymentModeId;

			}

			if (newInvoiceStatus.name === InvoiceStatus.VOID) {
				// Finish subscription, set subscription end date as today, move reservation to "finished" status
				await this.subscriptionRepository.save({
					...subscription,
					isOngoing: false,
					status: SubscriptionStatus.CANCELED,
					endDate: new Date(),
					updatedById: requestedByUser.id,
				});

				await this.reservationRepository.save({
					...reservation,
					status: ReservationStatus.FINISHED,
					updatedById: requestedByUser.id,
					hoursTo: dayjs().format('YYYY-MM-DD HH:mm:ss'),
				});
				invoice.invoiceStatus = newInvoiceStatus;				
			}

			if (newInvoiceStatus.name === InvoiceStatus.REFUNDED || newInvoiceStatus.name === InvoiceStatus.PARTIALLY_REFUNDED) {
				const amount = updateData.refundAmount || invoicePrice;

				if (paymentMode === null || paymentMode?.name === 'Card') {
					let refundResult: Stripe.Response<Stripe.Refund>;

				const savePayedInvoice = async () => {
					const refundObj = MainDataSource.getRepository(RefundEntity).create({
						createdById: requestedByUser.id,
						note: updateData.refundNote || '',
						amount,
						returnDate: new Date(),
						userId,
						invoiceId,
						createdAt: new Date(),
						updatedAt: new Date(),
					});

					const newRefundObj = await MainDataSource.getRepository(RefundEntity).save(refundObj);

					const refundData = MainDataSource.getRepository(RefundDataEntity).create({
						data: refundResult,
						userId,
						provider,
						invoiceId,
						refundId: newRefundObj.id,
						refund: refundResult && refundResult.status === 'succeeded',
						amount,
					});

					await MainDataSource.getRepository(RefundDataEntity).save(refundData);
				};

				if (paymentData.length && subTotal > 0) {
					const [stripe] = await useStripe(userId);

					const successPayedData = paymentData.find((pd: PaymentDataEntity) => pd.paid && !pd.refund);

					if (!successPayedData) throw new NotFoundError('No payment data to refund.');

					refundResult = await stripe.refunds.create({
						charge: String(successPayedData.data.id),
						amount,
						metadata: {
							invoiceId,
							userId,
							reservationId,
							env: NODE_ENV,
							serverUrl: SERVER_URL,
						},
					});

					if (refundResult.status === 'succeeded') {
						successPayedData.refund = true;
						invoice.refund = true;
						invoice.refundDate = dayjs().toDate().toDateString();
						await MainDataSource.getRepository(PaymentDataEntity).save(successPayedData);
						await savePayedInvoice();
					} else {
						throw new ForbiddenResponse({ message: 'Refund payment error' });
					}
				} else {
					invoice.refund = true;
					await savePayedInvoice();
				}

					if (subscriptionId) {
						const creditHours = invoice.items.map((ii: InvoiceItemEntity) => ii.creditHours).reduce((a, b) => a + b, 0);
						await subService.changeCreditHours({
							type: (space.spaceType.logicType === SpaceTypeLogicType.MINUTELY ? 'check-in' : 'conference') as HoursType,
							rotationType: CreditRotationType.SPACE,
							hours: -creditHours,
							userId,
							createdById: requestedByUser.id,
							subscriptionId,
						});
					}
				} else {
					const refundObj = MainDataSource.getRepository(RefundEntity).create({
						createdById: requestedByUser.id,
						note: updateData.refundNote || '',
						amount,
						returnDate: new Date(),
						userId,
						invoiceId,
						createdAt: new Date(),
						updatedAt: new Date(),
					});
					await MainDataSource.getRepository(RefundEntity).save(refundObj);

					invoice.refund = true;
				}
				invoice.refundDate = dayjs().toDate().toDateString();
				invoice.invoiceStatus = newInvoiceStatus;
			}
		} else {
			const newSecurityStatus = await MainDataSource.getRepository(SecurityDepositStatusEntity).findOneOrFail({
				where: { id: updateData.statusId },
			});

			const isSecurityDepositEnabled = await this.features.isEnabled(FeatureFlag.SecurityDeposit);
			if (isSecurityDepositEnabled && newSecurityStatus.name === "No Security Refund") {
				invoice.securityDepositStatus = newSecurityStatus;
			}
			else if (isSecurityDepositEnabled && newSecurityStatus.name.includes('Security Refund')) {
				const amount = updateData.refundAmount || requestedByUser.securityDeposit;
				const securityAmount = amount;

				let refundResult: Stripe.Response<Stripe.Refund>;

				const savePayedInvoice = async () => {
					const refundObj = MainDataSource.getRepository(RefundEntity).create({
						createdById: requestedByUser.id,
						note: updateData.refundNote || '',
						securityAmount,
						returnDate: new Date(),
						userId,
						invoiceId,
						createdAt: new Date(),
						updatedAt: new Date(),
					});

					const newRefundObj = await MainDataSource.getRepository(RefundEntity).save(refundObj);

					const refundData = MainDataSource.getRepository(RefundDataEntity).create({
						data: refundResult,
						userId,
						provider,
						invoiceId,
						refundId: newRefundObj.id,
						refund: refundResult && refundResult.status === 'succeeded',
						securityAmount,
					});

					await MainDataSource.getRepository(RefundDataEntity).save(refundData);
				};

				if (paymentData.length && subTotal > 0) {
					const [stripe] = await useStripe(userId);

					const successPayedData = paymentData.find((pd: PaymentDataEntity) => pd.paid && !pd.securityRefund);

					if (!successPayedData) throw new NotFoundError('No payment data to refund.');

					refundResult = await stripe.refunds.create({
						charge: String(successPayedData.securityDepositData.id),
						amount,
						metadata: {
							reason: 'SecurityDepositRefund',
							invoiceId,
							userId,
							reservationId,
							env: NODE_ENV,
							serverUrl: SERVER_URL,
						},
					});

					if (refundResult.status === 'succeeded') {
						successPayedData.securityRefund = true;
						await MainDataSource.getRepository(PaymentDataEntity).save(successPayedData);
						await savePayedInvoice();
					} else {
						console.log("Refund payment error.", { successPayedData, data: userId });
						throw new ForbiddenResponse({ message: 'Refund payment error' });
					}
				} else {
					await savePayedInvoice();
				}
				invoice.securityDepositStatus = newSecurityStatus;
			}
		}

		await this.invoiceRepository.save(invoice);

		if (
			[InvoiceStatus.SENT, InvoiceStatus.PAID, InvoiceStatus.REFUNDED, InvoiceStatus.PARTIALLY_REFUNDED].includes(
				newInvoiceStatus.name 
			)
		) {
			await this._sendEmail(invoiceId);
		}

		return invoice;
	}

	/**
	 * Update single invoice
	 * @param {string} id - Invoice ID
	 * @param {Partial<InvoiceEntity>} invoiceData - Invoice data to update
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @param {boolean} isWebhook - Requested from webhook
	 * @param {boolean} sendEmail
	 * @return {Promise<InvoiceEntity | undefined>} Returns invoice object or undefined
	 */
	async update(
		id: number,
		invoiceData: Partial<InvoiceEntity>,
		requestedByUser: UserEntity,
		isWebhook = false,
		sendEmail = false
	): Promise<InvoiceEntity | undefined> {
		let errorFlag = false;

		const inputInvoiceData = invoiceData;

		const subService = new SubscriptionService();

		const invoiceStatusList = await MainDataSource.getRepository(InvoiceStatusEntity).find();

		const paidInvoiceStatus = invoiceStatusList.find((s) => s.name === 'Paid');

		const oldInvoiceData = await this.invoiceRepository.findOneOrFail({
			where: { id },
			relations: [
				'providerData',
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
				'space.packageSubCategories',
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
				'providerData',
			],
		});
		console.log("inside invoice.service update ");
		if (!oldInvoiceData._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		const isUpcoming = oldInvoiceData.invoiceStatus?.name === 'Upcoming';

		const newInvoiceStatus = invoiceStatusList.find((s) => Number(s.id) === Number(inputInvoiceData.invoiceStatusId));

		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		if (
			typeof paidInvoiceStatus !== 'undefined' &&
			Number(oldInvoiceData.invoiceStatusId) === Number(paidInvoiceStatus.id) &&
			newInvoiceStatus &&
			newInvoiceStatus.name !== 'Refunded'
		)
			throw new ForbiddenResponse({ message: "Invoice is Payed. Can't edit!" });

		if (
			typeof inputInvoiceData.invoiceStatusId !== 'undefined' &&
			Number(inputInvoiceData.invoiceStatusId) !== Number(oldInvoiceData.invoiceStatusId)
		) {
			if (newInvoiceStatus && newInvoiceStatus.name === 'Paid') {
				if (oldInvoiceData.invoiceStatusId === newInvoiceStatus.id) throw new ForbiddenResponse({ message: 'Already paid' });
				console.log("inside invoice.service update newInvoiceStatus && newInvoiceStatus.name === 'Paid'");
				try {
					if (invoiceData?.instantlyBookableRequested) {

						if (invoiceData?.instantlyBookableResponse) {

						const charged = await this.processPayment(
							oldInvoiceData,
							{
								endDate: '',
								startDate: '',
								userId: String(oldInvoiceData.userId),
								takePayment: !isWebhook,
							},
							requestedByUser,
							false
						);

						if (charged && oldInvoiceData.space) {
							await this._deductSpaceQuantity(oldInvoiceData.space);
							sendEmail = true;
						}
						if (!charged) {
							errorFlag = true;
							loggerHelper.error('NOT CHARGED');
						}
					}
					else
					{
						const charged = await this.processPayment(
							oldInvoiceData,
							{
								endDate: '',
								startDate: '',
								userId: String(oldInvoiceData.userId),
								takePayment: !isWebhook,
							},
							requestedByUser,
							false
						);

						if (charged && oldInvoiceData.space) {
							await this._deductSpaceQuantity(oldInvoiceData.space);
							sendEmail = true;
						}
						if (!charged) {
							errorFlag = true;
							loggerHelper.error('NOT CHARGED');
						}

					}
					}				
				} catch (e) {
					errorFlag = true;
					loggerHelper.error(e);
				}

				inputInvoiceData.paid = true;
				inputInvoiceData.payDate = inputInvoiceData.payDate || dayjs().format();
				console.log("inside invoice.service update calling processRecurringCredits with oldInvoiceData subscription id"+ JSON.stringify(oldInvoiceData));
				const isMonthly = oldInvoiceData.space.spaceType.logicType == SpaceTypeLogicType.MONTHLY ? true : false;
				if (oldInvoiceData.subscriptionId) await this.subscriptionService.processRecurringCredits(oldInvoiceData.subscriptionId, isMonthly, inputInvoiceData.processDate);
			}

			if (newInvoiceStatus && newInvoiceStatus.name === 'Void') {
				if (oldInvoiceData.invoiceStatusId === newInvoiceStatus.id) throw new ForbiddenResponse({ message: 'Already void' });
				sendEmail = true;
				// Finish subscription, set subscription end date as today, move reservation to "finished" status
				await this.subscriptionRepository.save({
					...oldInvoiceData.subscription,
					isOngoing: false,
					status: SubscriptionStatus.CANCELED,
					endDate: new Date(),
					updatedById: invoiceData.updatedById,
				});

				await this.reservationRepository.save({
					...oldInvoiceData.reservation,
					status: ReservationStatus.FINISHED,
					updatedById: invoiceData.updatedById,
					hoursTo: dayjs().format('YYYY-MM-DD HH:mm:ss'),
				});
			}

			if (newInvoiceStatus && newInvoiceStatus.name === 'Refunded') {
				if (oldInvoiceData.invoiceStatusId === newInvoiceStatus.id) throw new ForbiddenResponse({ message: 'Already refunded' });

				sendEmail = true;

				let { userId } = oldInvoiceData;
				const invoiceId = oldInvoiceData.id;
				const amount = parseInt(String(invoiceData.refundAmount), 10);
				let invoicePrice = oldInvoiceData.subTotal + oldInvoiceData.tax;

				let refundResult: Stripe.Response<Stripe.Refund>;

				let provider = PaymentProvider.STRIPE;

				const savePayedInvoice = async () => {
					const refundObj = MainDataSource.getRepository(RefundEntity).create({
						createdById: requestedByUser.id,
						note: inputInvoiceData.refundNote || '',
						amount,
						returnDate: new Date(),
						userId,
						invoiceId,
						createdAt: new Date(),
						updatedAt: new Date(),
					});

					const newRefundObj = await MainDataSource.getRepository(RefundEntity).save(refundObj);

					const refundData = MainDataSource.getRepository(RefundDataEntity).create({
						data: refundResult,
						userId,
						provider,
						invoiceId,
						refundId: newRefundObj.id,
						refund: refundResult && refundResult.status === 'succeeded',
						amount,
					});

					await MainDataSource.getRepository(RefundDataEntity).save(refundData);

					const refundStatus = invoiceStatusList.find(
						(s) => s.name === (amount / 100 === Number(invoicePrice) ? 'Refunded' : 'Partially Refunded')
					);

					if (typeof refundStatus !== 'undefined') inputInvoiceData.invoiceStatusId = refundStatus.id;
				};

				if (oldInvoiceData.providerData && oldInvoiceData.providerData.length && oldInvoiceData.providerData[0].providerInvoiceId) {
					const [stripe] = await useStripe(oldInvoiceData.userId);

					const stripeInvoice = await stripe.invoices.retrieve(oldInvoiceData.providerData[0].providerInvoiceId);

					userId = oldInvoiceData.userId;
					provider = PaymentProvider.STRIPE;
					invoicePrice = amount / 100;

					if (stripeInvoice.charge) {
						const refundResult = await stripe.refunds.create({
							charge: stripeInvoice.charge as string,
							amount,
							metadata: {
								invoiceId: oldInvoiceData.id,
								userId: oldInvoiceData.userId,
								reservationId: oldInvoiceData.reservationId,
								env: NODE_ENV,
								serverUrl: SERVER_URL,
							},
						});
						if (refundResult.status !== 'succeeded') {
							errorFlag = true;
						}
					}
				}

				if (!errorFlag) {
					inputInvoiceData.refund = true;
					await savePayedInvoice();
				}

				if (oldInvoiceData.subscriptionId) {
					const creditHours = oldInvoiceData.items.map((ii) => ii.creditHours).reduce((a, b) => a + b, 0);
					await subService.changeCreditHours({
						type: (oldInvoiceData.space.spaceType.logicType === SpaceTypeLogicType.MINUTELY ? 'check-in' : 'conference') as HoursType,
						rotationType: CreditRotationType.SPACE,
						hours: -creditHours,
						userId: oldInvoiceData.userId,
						createdById: requestedByUser.id,
						subscriptionId: oldInvoiceData.subscriptionId,
					});
				}
			}
			delete oldInvoiceData.invoiceStatus;
		}

		oldInvoiceData.updatedById = invoiceData.updatedById || Number(oldInvoiceData.userId);

		// process new invoice items
		const oldItems = inputInvoiceData.items ? inputInvoiceData.items.filter((i) => i.id) : [];
		const newItems = inputInvoiceData.items
			? inputInvoiceData.items
					.filter((i) => typeof i.id === 'undefined')
					.map((i) => {
						const item = { ...i };
						item.quantity = 1;
						item.price2 = i.price || 0;
						item.creditHours = 0;
						item.amenityHoursIncluded = 0;
						item.paid = false;
						item.dateBought = new Date();
						item.createdById = oldInvoiceData.createdById;
						item.updatedById = Number(invoiceData.updatedById);
						return item;
					})
			: [];

		inputInvoiceData.items = oldItems.concat(newItems);

		if (!isWebhook) {
			oldInvoiceData.subTotal = oldInvoiceData.items.map((i) => Number(i.price2)).reduce((a, b) => a + b, 0);

			oldInvoiceData.tax = oldInvoiceData.items.map((i) => (i.price2 / 100) * i.tax).reduce((a, b) => a + b, 0);
		}

		this.invoiceRepository.merge(oldInvoiceData, inputInvoiceData);

		await this.invoiceRepository.save(oldInvoiceData);

		if (sendEmail) {
			// if (newInvoiceStatus && ['Paid', 'Refund', 'Partial Refund'].includes(newInvoiceStatus.name)) {
			await this._sendEmail(id, isUpcoming ? InvoiceEmailTypes.UPCOMING : InvoiceEmailTypes.DEFAULT, { oldInvoiceData });
		}

		if (errorFlag) {
			if (isUpcoming) {
				await this._saveUpcoming(oldInvoiceData.id);
			}
			throw new ErrorResponse({ message: oldInvoiceData.failureMessage || 'Error occurred' });
		}
		return oldInvoiceData;
	}

	async _sendEmail(
		invoiceId: number | string,
		type: InvoiceEmailTypes = InvoiceEmailTypes.DEFAULT,
		props?: { oldReservation?: ReservationEntity; oldInvoiceData?: InvoiceEntity }
	) {
		try {
			const invoice = await this.getFullInvoice(+invoiceId);

			const isCanceledReservation = invoice.reservation?.status === ReservationStatus.CANCELED;

			// check if amount > 0.1
			if (
				invoice.space.chargeType !== ChargeType.FREE &&
				invoice.space.spaceType.logicType === SpaceTypeLogicType.MONTHLY &&
				invoice.subTotal < 0.1
			)
				return;

			if (!invoice || (['Upcoming', 'New'].includes(invoice.invoiceStatus!.name) && (invoice.instantlyBookableRequested && !isCanceledReservation))) return;


			const invoiceStatusName = String(invoice.invoiceStatus?.name);

			const user = await this.userRepository
				.createQueryBuilder('User')
				.leftJoinAndSelect('User.photo', 'photo')
				.leftJoinAndSelect('User.brand', 'brand')
				.leftJoinAndSelect('User.teamMembership', 'teamMembership', 'teamMembership.status != :memberRemovedStatus', {
					memberRemovedStatus: TeamMemberStatus.MEMBER_REMOVED,
				})
				.leftJoinAndSelect('teamMembership.team', 'team')
				.leftJoinAndSelect('team.brand', 'teamBrand')
				.leftJoinAndSelect('team.subscriptions', 'subscriptions', 'subscriptions.isOngoing = true')
				.leftJoinAndSelect('team.teamLead', 'teamLead')
				.where('User.id=:userId', { userId: invoice.userId })
				.getOne();

			if (!user) throw new ValidationErrorResp({ message: 'Wrong user!' });

			const getSpaceWithPositiveAmount = (lineItems: Stripe.InvoiceLineItem[]): Stripe.InvoiceLineItem | undefined => {
				const stripeSpaceProductId = StripeService.getSpaceStripeId(invoice.spaceId);
				return lineItems.find((li) => (li.price?.product as Stripe.Product).id === stripeSpaceProductId && !li.proration);
			};

			const invoiceNumber = getInvoiceNumber(invoice);

			const messageData: any = {
				issuedTo: {
					firstName: user.firstname,
					lastName: user.lastname,
					fullname: `${user.firstname} ${user.lastname}`,
					email: user.email,
					photo: user.photo ? user.photo.url : `https://${DOMAIN}/images/header/default-avatar.png`,
					phone: String(user.phone)
				},
				invoice: {
					tax: invoice.tax,
					subTotal: invoice.subTotal,
					failureMessage: invoice.failureMessage ? invoice.failureMessage : '',
					status: invoice.invoiceStatus ? invoice.invoiceStatus.name : 'Paid',
					date: getInvoiceProcessingDateString(invoice),
					payDate: getInvoicePayDateString(invoice, 'MM/DD/YY'),
					amount: `${getCurrencySymbol(DEFAULT_CURRENCY.code)} ${Number(invoice.subTotal + invoice.tax).toFixed(2)}`,
					invoiceNumber,
				},
				disputeUrl: `https://${DOMAIN}/customer/billing/dispute?id=${invoice.id}`,
				emailTo: user.email,
				brandId: user.brandId,
			};

			let currency = invoice.currency;

			if (invoice.stripeInvoice) {
				const spaceLineItem = getSpaceWithPositiveAmount(invoice.stripeInvoice.lines.data);

				currency = invoice.stripeInvoice.currency.toUpperCase();

				messageData.providerInvoice = {
					amountPaid: invoice.stripeInvoice.amount_paid / 100,
					amountDue: invoice.stripeInvoice.amount_due / 100,
					created: invoice.stripeInvoice.created,
					currency: getCurrencySymbol(invoice.stripeInvoice.currency.toUpperCase()),
					number: invoice.stripeInvoice.number,
					periodEnd: spaceLineItem ? dayjs.unix(spaceLineItem.period.end).format('ddd MMM D YYYY') : '',
					periodStart: spaceLineItem ? dayjs.unix(spaceLineItem.period.start).format('ddd MMM D YYYY') : '',
					status: invoice.stripeInvoice.status,
					subtotal: invoice.stripeInvoice.subtotal / 100,
					tax: invoice.stripeInvoice.tax,
					total: invoice.stripeInvoice.total / 100,
					invoicePdf: invoice.stripeInvoice.invoice_pdf,
					hostedInvoiceUrl: invoice.stripeInvoice.hosted_invoice_url,
				};

				messageData.lines = invoice.items.map((item: InvoiceItemEntity) => ({
					name: item.name,
					price: `${getCurrencySymbol(currency.toUpperCase())} ${item.price}`,
					price2: `${getCurrencySymbol(currency.toUpperCase())} ${item.price2}`,
					tax: item.tax,
					quantity: item.quantity || 1,
					chargeType: item.chargeType,
					hours: item.quantity,
					creditHours: SecondsToTimeHelper(item.creditHours * 60 * 60),
					duration: SecondsToTimeHelper(item.quantity * 60 * 60),
				}));
			} else {
				messageData.lines = invoice.items.map((item: InvoiceItemEntity) => ({
					name: item.name,
					price: `${getCurrencySymbol(invoice.venue.currency.toUpperCase())} ${item.price}`,
					price2: `${getCurrencySymbol(invoice.venue.currency.toUpperCase())} ${item.price2}`,
					tax: item.tax,
					quantity: item.quantity || 1,
					chargeType: item.chargeType,
					hours: item.quantity,
					creditHours: SecondsToTimeHelper(item.creditHours * 60 * 60),
					duration: SecondsToTimeHelper(item.quantity * 60 * 60),
				}));
			}

			let userTemplateTypeName = 'Custom Invoice Confirmation';

			if (invoice.spaceId) {
				const space = await this.spaceRepository.findOneOrFail({
					where: { id: invoice.spaceId },
					relations: ['venue', 'venue.logo', 'venue.createdBy', 'venue.photos', 'spaceType', 'photos'],
				});

				const { venue } = space;

				let spaceImage = `https://${DOMAIN}/images/default-image.jpg`;
				let venueImage = `https://${DOMAIN}/images/default-image.jpg`;
				let venueLogo = `https://${DOMAIN}/images/logo-small.png`;

				const spacePhotos: FileEntity[] = space.photos;
				if (spacePhotos && spacePhotos.length) {
					spaceImage = `${MEDIA_URL}/434x176${spacePhotos[0].url}`;
				}

				if (venue.logo) {
					venueLogo = `${MEDIA_URL}/434x176${venue.logo.url}`;
				}

				const venuePhotos: FileEntity[] = venue.photos;
				if (venuePhotos && venuePhotos.length) {
					venueImage = `${MEDIA_URL}/434x176${venuePhotos[0].url}`;
				}

				messageData.invoice.amount = getInvoiceFullPriceString(invoice);

				if (!invoice.stripeInvoice)
					messageData.lines = invoice.items.map((item: InvoiceItemEntity) => ({
						id: item.id,
						name: item.name,
						price: `${getCurrencySymbol(currency)} ${item.price.toFixed(2)}`,
						price2: `${getCurrencySymbol(currency)} ${item.price2.toFixed(2)}`,
						tax: `${getCurrencySymbol(currency)} ${space.tax}`,
						quantity: item.quantity || 1,
						chargeType: item.chargeType,
						hours: item.quantity,
						creditHours: getInvoiceCredits(invoice),
						duration: SecondsToTimeHelper(item.quantity * 60 * 60),
					}));

					const reservation = await MainDataSource.getRepository(ReservationEntity).findOne({
						where: { invoiceId:invoice.id },
					});

				messageData.venue = {
					name: venue.name,
					logo: venueLogo,
					image: venueImage,
					specialInstructions: venue.specialInstructions,
					address: venue.address,
					address2: venue.address2,
					email: venue.email || venue.createdBy.email,
					phone: (String(venue.phone || venue.createdBy.phone)),
					id: venue.id,
				};

				if(space.chargeType == ChargeType.ONE_TIME && reservation)
					{	
						const accessHours = await MainDataSource.getRepository(AccessCustomDataEntity).find({
							where: { venueId: venue.id },
						});

						if(accessHours)
						venue.accessCustomData = accessHours;

						messageData.venue.VenueOperationTime = getVenueOperationTime(venue,dayjs(reservation.hoursFrom)
						.format('dddd'),)
					}

				messageData.space = {
					name: space.name,
					image: spaceImage,
					chargeType: space.chargeType,
					packageType: space.spaceType.name,
					spaceType: space.spaceType.name,
					logicType: space.spaceType.logicType,
					packageShow : space.packageShow
				};

				if (invoice.reservationId) {
					const resev = await this.reservationRepository.findOne({ where: { id: invoice.reservationId } });

					if (resev) {
						// we need to send correct time format
						const isUSA = (resev.tzUser || resev.tzLocation).indexOf('America') !== -1;
						const timeFormat = isUSA ? 'hh:mm A' : 'HH:mm';

						const getReservTime = (time: string) =>
							dayjs(time)
								.tz(resev.tzLocation)
								// .tz(resev.tzUser || resev.tzLocation)
								.format(`D MMMM YYYY ${timeFormat}`);

						messageData.reservation = {
							hoursFrom: getReservTime(resev.hoursFrom),
							hoursTo: resev.hoursTo ? getReservTime(resev.hoursTo) : 'In progress',
							bookedAt: dayjs(resev.bookedAt)
								.tz(resev.tzLocation)
								// .tz(resev.tzUser || resev.tzLocation)
								.format('ddd MMM D YYYY'),
							chargeType: resev.chargeType,
							userTz: resev.tzUser || resev.tzLocation,
						};

						if (props?.oldReservation) {
							messageData.reservation.originalHoursFrom = getReservTime(props.oldReservation.hoursFrom);
							messageData.reservation.originalHoursTo = props.oldReservation.hoursTo
								? getReservTime(props.oldReservation.hoursTo)
								: 'In progress';
						}
					}
				}

				userTemplateTypeName = 'Booking space confirmation';
				let adminTemplateTypeName = 'Booking confirmation for admin';

				if (space.spaceType.logicType === SpaceTypeLogicType.HOURLY) {
					// if ([ChargeType.HOURLY, ChargeType.ONE_TIME].includes(space.chargeType)) {
					userTemplateTypeName = 'Booking hourly space confirmation';
					adminTemplateTypeName = 'Booking hourly confirmation for admin';
				}

				if (space.spaceType.logicType === SpaceTypeLogicType.MINUTELY) {
					if (type === InvoiceEmailTypes.CHECK_IN) {
						userTemplateTypeName = 'Check-in space confirmation';
						adminTemplateTypeName = 'Check-in confirmation for admin';
					}
					if (type === InvoiceEmailTypes.CHECK_OUT) {
						userTemplateTypeName = 'Check-out space confirmation';
						adminTemplateTypeName = 'Check-out confirmation for admin';
					}
					if (type === InvoiceEmailTypes.DEFAULT) {
						userTemplateTypeName = 'Booking hourly space confirmation';
						adminTemplateTypeName = 'Booking hourly confirmation for admin';
					}
				}
				//
				// if (space.chargeType === ChargeType.FREE) {
				// 	userTemplateTypeName = 'Booking free space confirmation';
				// 	adminTemplateTypeName = 'Free Booking confirmation for admin';
				// }

				if (type === InvoiceEmailTypes.RESERVATION_CHANGED) {
					userTemplateTypeName = 'Change reservation';
					adminTemplateTypeName = 'Change reservation for admin';
				}

				if (type === InvoiceEmailTypes.UPCOMING) {
					userTemplateTypeName = 'Upcoming invoice paid';
					adminTemplateTypeName = 'Upcoming invoice paid for admin';
				}

				if (['Refunded', 'Partially Refunded'].includes(invoiceStatusName) ||(['New'].includes(invoiceStatusName) && invoice.instantlyBookableRequested) ) {
					userTemplateTypeName = 'Invoice Refund';
					if (isCanceledReservation) {
						userTemplateTypeName = 'Cancellation reservation';
						adminTemplateTypeName = 'Cancellation reservation for admin';
						await sendUserDefinedTemplate(adminTemplateTypeName, {
							...messageData,
							emailTo: venue.email || venue.createdBy.email,
							brandId: venue.brandId,
						});
					}
				} else {
					if (user.teamMembership && user.teamMembership.length > 0) {
						const sameBrandMembership = user.teamMembership.find(
							(t) => t.team!.brandId === invoice.brandId && t.team!.subscriptions && t.team!.subscriptions.length > 0
						);
						if (sameBrandMembership && sameBrandMembership.team!.teamLeadId !== invoice.userId) {
							if(await this.sendMembershipEmail(adminTemplateTypeName, space.spaceType.logicType, space.packageShow, space.chargeType)){
							await sendUserDefinedTemplate(adminTemplateTypeName, {
								...messageData,
								emailTo: sameBrandMembership.team!.teamLead!.email,
								brandId: venue.brandId,
							},space?.spaceType?.logicType);
						}
						}
					}
					
					if(await this.sendMembershipEmail(adminTemplateTypeName, space.spaceType.logicType, space.packageShow, space.chargeType)){
					await sendUserDefinedTemplate(adminTemplateTypeName, {
						...messageData,
						emailTo: venue.email || venue.createdBy.email,
						brandId: venue.brandId,
					},space?.spaceType?.logicType);
				}
				}
			}

            const isSendBookingSMSEnabled = await this.features.isEnabled(FeatureFlag.sendBookingSMS);
		if (isSendBookingSMSEnabled && process.env.POSTGRES_HOST !== 'localhost' && invoiceStatusName === 'Paid') {
				try
				{

				const venueData = await MainDataSource.getRepository(VenueEntity).findOneOrFail({
					where: { id:invoice.venueId },
					relations: ['accessCustomData']
				});

                await sendBookingSMS({ 
					venue: venueData,
                    firstName: messageData.issuedTo.firstName,
                    userPhone: String(user.phone),
                    bookedAt: messageData.reservation.bookedAt,
					bookedForDate: dayjs(messageData.reservation.hoursFrom)
								.format('ddd MMM D YYYY'),
					bookedForDay : dayjs(messageData.reservation.hoursFrom)
					.format('dddd'),
                    hoursFrom: messageData.reservation.hoursFrom,
                    hoursTo: messageData.reservation.hoursTo,
                    price: `${Number(invoice.subTotal + invoice.tax).toFixed(2)} ${invoice.currency.toUpperCase()}`,
                    spaceName: messageData.space.name,                    
                    venueAddress: messageData.venue.address,
                    venuePhone: String(invoice.venue.phone || invoice.venue.createdBy.phone),
                    venueName: messageData.venue.name,
					venueId : messageData.venue.id,
					bookingType: messageData.space.chargeType,
                });
			}
			catch(e){
				loggerHelper.error('Error in Sending SMS - ', e);
			}
            }
			if(await this.sendMembershipEmail(userTemplateTypeName, messageData.space.logicType, messageData.space.packageShow, messageData.space.chargeType)){
			return await sendUserDefinedTemplate(userTemplateTypeName, messageData,messageData.space?.logicType);
		}
		} catch (e) {
			loggerHelper.error('SEND EMAIL ERROR - ', e);
		}
	}

	/**
	 * Saves reservation and user subscriptions with credit hours, access hours, available to user space types, updates invoice and invoice items and creates new upcoming invoice
	 * @param {number} invoiceId - Invoice ID
	 * @param {CreateInvoiceDto} params - HTTP request params
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @return {Promise<SubscriptionEntity | null>}
	 */
	async _saveReservation(invoiceId: number, params: CreateInvoiceDto, requestedByUser: UserEntity): Promise<SubscriptionEntity | null> {
		const { startDate, endDate, userTz, takePayment } = params;

		const teamService = new TeamService();

		const invoiceData: Partial<InvoiceEntity> = {};

		const invoice = await this.invoiceRepository.findOneOrFail({
			where: { id: invoiceId },
			relations: ['issuedTo', 'venue', 'items'],
		});

		const space = await this.spaceRepository.findOneOrFail({
			where: { id: invoice.spaceId },
			relations: ['spaceType', 'packageVenueTypes', 'packageVenues', 'packageSpaceTypes', 'creditHours', 'packageBrands','packageSubCategories',],
		});

		const reservation = this.reservationRepository.create();

		reservation.spaceId = invoice.spaceId;
		reservation.userId = invoice.issuedTo.id;
		reservation.invoiceId = invoice.id;
		reservation.bookedAt = invoice.processDate as unknown as Date;
		reservation.venueId = invoice.venueId;
		reservation.status = ReservationStatus.ACTIVE;
		reservation.chargeType = space.chargeType;
		reservation.price = invoice.subTotal + invoice.tax;
		reservation.hoursFrom = startDate;
		reservation.hoursTo = endDate;
		reservation.createdById = invoice.createdById;
		reservation.updatedById = invoice.updatedById;
		reservation.tzLocation = invoice.venue.tzId;
		if (userTz) {
			reservation.tzUser = userTz;
		}

		const savedReservation = await this.reservationRepository.save(reservation);

		if (!invoice.reservationId) {
			invoiceData.reservation = savedReservation;
		}

		await Promise.all(
			invoice.items.map(async (item) => {
				const clonedItem = item;
				if (!item.reservationId) {
					clonedItem.reservationId = savedReservation.id;
					await this.invoiceItemRepository.save(clonedItem);
				}
			})
		);

		if (space.spaceType.logicType !== SpaceTypeLogicType.MONTHLY) {
			await this.invoiceRepository.save({ ...invoiceData, id: invoiceId });
			return null;
		}

		const configDate = dayjs(invoice.processDate).add(1, 'month').startOf('month');

		const subscription = this.subscriptionRepository.create();
		subscription.name = space.name;
		subscription.userId = invoice.issuedTo.id;
		subscription.spaceId = invoice.spaceId;
		subscription.brandId = invoice.venue.brandId;
		subscription.venueId = invoice.venueId;
		subscription.isOngoing = true;
		subscription.takePayment = Boolean(takePayment);
		subscription.securityAmount = space.securityDepositPrice || 0;
		subscription.startDate = startDate ? dayjs(startDate).toDate() : new Date();
		subscription.endDate = endDate ? dayjs(endDate).toDate() : new Date(new Date().setFullYear(new Date().getFullYear() + 10));
		subscription.spaceAmount = space.price;
		subscription.allowPublicSpaces = space.allowPublicSpaces;
		subscription.billCycleDate = space.billCycleStart;
		// @ts-ignore
		subscription.payDate = invoice.processDate ? configDate.toDate() : null;
		subscription.chargeType = ChargeType.CHARGE_NOW;
		subscription.createdById = invoice.createdById;
		subscription.updatedById = invoice.updatedById;

		subscription.access247 = space.access247;

		let savedSubscription = await this.subscriptionRepository.save(subscription);

		await Promise.all(
			invoice.items.map(async (item) => {
				const clonedItem = item;
				if (!item.subscriptionId) {
					clonedItem.subscriptionId = savedSubscription.id;
					await this.invoiceItemRepository.save(clonedItem);
				}
			})
		);

		const subscriptionCreditDataRepo = MainDataSource.getRepository(SubscriptionCreditHoursEntity);

		//
		if ([PackageShow.MEMBERSHIP, PackageShow.TEAM_MEMBERSHIP].includes(space.packageShow)) {
			if (space.packageBrands) {
				savedSubscription.brands = space.packageBrands;
			}

			if (space.packageVenueTypes) {
				savedSubscription.venueTypes = space.packageVenueTypes;
			}

			if (space.packageVenues) {
				savedSubscription.venues = space.packageVenues;
			}

			if (space.packageSpaceTypes) {
				savedSubscription.spaceTypes = space.packageSpaceTypes;
			}
			if (space.packageSubCategories) {
				savedSubscription.subCategories = space.packageSubCategories;
			}
			savedSubscription = await this.subscriptionRepository.save(savedSubscription);
		}
		//
		if (space.creditHours){
			await Promise.all(
				space.creditHours.map(async (spaceHours: SpaceCreditHoursEntity) => {
					const creditHour = subscriptionCreditDataRepo.create({
						...spaceHours,
						subscriptionId: subscription.id,
						used: 0,
						given: spaceHours.given,
						monthlyAmount: spaceHours.given,
						userId: invoice.userId,
						id: undefined,
					});
					console.log('space.creditHours: true creditshours: '+ String(creditHour));
					await subscriptionCreditDataRepo.save(creditHour);
					console.log('space.creditHours: true creditshours after save: '+ String(creditHour));
				})
			);
		}
		if (!space.creditHours || (space.creditHours && space.creditHours.length === 0)){
			await Promise.all(
				[HoursType.CONFERENCE, HoursType.CHECK_IN].map(async (type: HoursType) => {
					const creditHour: SubscriptionCreditHoursEntity = subscriptionCreditDataRepo.create({
						given: 0,
						type,
						recurringMonth: 0,
						notRecurring: false,
						recurringForever: false,
						rollover: false,
						subscriptionId: subscription.id,
						used: 0,
						userId: invoice.userId,
					});
					console.log('space.creditHours: false creditshour: '+ String(creditHour));
					await subscriptionCreditDataRepo.save(creditHour);
					console.log('space.creditHours: false creditshour after save: '+ String(creditHour));
				})
			);
		}
		invoiceData.subscription = savedSubscription;
		console.log('invoiceData.subscription: '+ String(savedSubscription));
		if (space.packageShow === PackageShow.TEAM_MEMBERSHIP) {
			const invoiceUser = await MainDataSource.getRepository(UserEntity).findOneOrFail({
				where: { id: invoice.userId },
				relations: ['leadingTeams', 'leadingTeams.subscriptions'],
			});
			/**
			 * If its team membership:
			 * 1. search for user team without subscription.
			 * 1.1. if found - add subscription to team
			 * 1.2. if not found - create new team and subscription for team
			 */
			const teamWithoutSub = invoiceUser.leadingTeams ? invoiceUser.leadingTeams.filter((t: TeamEntity) => t.subscriptions!.length === 0) : [];

			if (teamWithoutSub.length === 0) {
				const newTeam = await teamService.create(
					{
						name: params.teamName || `${savedSubscription.name} team`,
						brandId: savedSubscription.brandId,
						teamLeadId: invoice.userId,
						createdById: requestedByUser.id,
					},
					requestedByUser
				);
				invoiceData.teamId = newTeam.id;
				await teamService.addSubscription(newTeam.id, savedSubscription.id, requestedByUser);
			} else {
				invoiceData.teamId = teamWithoutSub[0].id;
				await teamService.addSubscription(teamWithoutSub[0].id, savedSubscription.id, requestedByUser);
			}
		}

		const savedInv = await this.invoiceRepository.save({ ...invoiceData, id: invoiceId });

		if (!params.isWebhook && params.takePayment) {
			await this.stripeService.createSubscription({
				createdById: requestedByUser.id,
				subscriptionId: savedSubscription.id,
				reservationId: invoice.reservationId,
				spaceId: invoice.spaceId,
				venueId: invoice.venueId,
				userId: invoice.userId,
				brandId: invoice.brandId,
				invoiceId: invoice.id,
				invoiceNumber: invoice.invoiceNumber,
				teamId: invoice.teamId,
				endDate: dayjs(subscription.endDate).utc().unix(),
				markAsPaid: String.toString()
			});
		}
		await this._saveUpcoming(savedInv.id);
		console.log('returning saved subscription: '+ String(savedSubscription));
		return savedSubscription;
	}

	/**
	 * Marks space as booked for user.
	 * @param {number} spaceId - Space ID
	 * @param {number} userId - User ID
	 * @return {Promise<UserPrivatePackageEntity | Error | undefined>}
	 */
	async _updateUserPrivatePackages(spaceId: number, userId: number): Promise<UserPrivatePackageEntity | Error | undefined> {
		try {
			const userPPRepo = MainDataSource.getRepository(UserPrivatePackageEntity);
			let userPP = await userPPRepo.findOne({ where: { spaceId, userId } });
			if (!userPP) {
				userPP = userPPRepo.create();
				userPP.userId = userId;
				userPP.spaceId = spaceId;
			}
			userPP.status = PackageStatus.BOOKED;

			return await userPPRepo.save(userPP);
		} catch (e) {
			loggerHelper.error(e);
		}
	}

	/**
	 * Deducts space quantity.
	 * @param {SpaceEntity} space - Space entity
	 * @return {Promise<SpaceEntity>} - Space
	 */
	async _deductSpaceQuantity(space: SpaceEntity): Promise<void> {
		const inputSpaceData = space;
		const now = new Date();
		/**
		 * Process spaces quantity
		 */
		if (!inputSpaceData.quantityUnlimited) {
			let used = Number(inputSpaceData.usedQuantity) || 0;

			const saveObj: Partial<SpaceEntity> = {};

			used += 1;
			saveObj.quantity = space.quantity - 1;
			saveObj.usedQuantity = used;
			saveObj.lastUsed = now;
			if (saveObj.quantity <= 0) {
				saveObj.status = SpaceStatus.UNPUBLISED;
			}

			if (!inputSpaceData.quantityRepublish) saveObj.quantityRepublish = 0;

			await this.spaceRepository.update(inputSpaceData.id, saveObj);
		}
	}

	/**
	 *
	 * @param invoice
	 * @param request
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async processPayment(invoice: InvoiceEntity, request: CreateInvoiceDto, requestedByUser: UserEntity | undefined, isMarkAsPaid: boolean): Promise<boolean | Error> {
		const paymentFailedStatus = await this._getStatusByName('Payment Failed');

		if (!paymentFailedStatus) {
			loggerHelper.error('Invoice payment failed: cant find failed status in DB', { invoice, data: request });
			throw new ValidationErrorResp({ message: 'Wrong invoice status' });
		}

		const inputInvoiceData = invoice;

		const saveData: Partial<InvoiceEntity> = {};

		const payDate = request.userTz ? dayjs().tz(request.userTz) : dayjs();

		const user = inputInvoiceData.issuedTo;

		const { brand } = user;

		let { takePayment } = request;
		if (typeof takePayment === 'undefined') takePayment = true;

		if (brand!.chargeCustomer && takePayment) {
			if (inputInvoiceData.space.spaceType.logicType !== SpaceTypeLogicType.MONTHLY) {
				try {
					const spaceItem = inputInvoiceData.items.find((i) => i.invoiceItemType === InvoiceItemType.SPACE);

					// todo fixme. need to fine better way
					let spaceItemQuantity = spaceItem ? spaceItem.quantity - spaceItem.creditHours : 1;
					if (spaceItemQuantity < 0) spaceItemQuantity = 0;

					const stripeInvoice = await this.stripeService.createInvoice({
						spaceId: inputInvoiceData.spaceId,
						appInvoice: inputInvoiceData,
						userId: user.id,
						quantity: spaceItem ? spaceItemQuantity : 1,
					});
					
					await this.invoiceProviderDataRepository.save(
						this.invoiceProviderDataRepository.create({
							providerInvoiceId: String(stripeInvoice.id),
							providerInvoiceNumber: String(stripeInvoice.number),
							provider: PaymentProvider.STRIPE,
							invoiceId: inputInvoiceData.id,
						})
					);

					saveData.processDate = dayjs.unix(stripeInvoice.created).format();

					if (!stripeInvoice.paid) {
						loggerHelper.error('Invoice payment failed: charge result not paid', { invoice, data: request, stripeInvoice });
						saveData.paidAmount = 0;
						saveData.paid = false;
						saveData.failureMessage = 'Payment Failed';
						saveData.invoiceStatus = paymentFailedStatus;
						saveData.invoiceStatusId = paymentFailedStatus.id;
						saveData.securityDepositStatusId = paymentFailedStatus.id;
						if (inputInvoiceData.reservation) {
							saveData.reservation!.status = ReservationStatus.DELETED;
						}
						await this.invoiceRepository.save({ id: inputInvoiceData.id, ...saveData });
						await this._sendEmail(inputInvoiceData.id);
						return false;
					} else {
						if (await this.features.isEnabled(FeatureFlag.SecurityDeposit) && !isMarkAsPaid) {
							await this.stripeService.createSecurityDepositInvoice({
								spaceId: inputInvoiceData.spaceId,
								appInvoice: inputInvoiceData,
								userId: user.id,
							});
						}

						if (stripeInvoice.charge) {
							const stripeCharge = await this.stripeService.getChargeById(stripeInvoice.charge as string, user.id);
							saveData.payDate = dayjs.unix(stripeCharge.created).format();
						}

						saveData.subTotal = stripeInvoice.subtotal / 100;
						saveData.paid = stripeInvoice.paid;
						saveData.tax = Number(stripeInvoice.tax) / 100;
						saveData.paidAmount = stripeInvoice.amount_paid / 100;
						saveData.invoiceStatus = (await this._getStatusByName('Paid')) || undefined;
						if(!isMarkAsPaid)
						saveData.securityDepositStatus = (await this._getSecurityStatusByName('Paid')) || undefined;
					}
				} catch (e) {
					const { message } = e as Error;
					loggerHelper.error('STRIPE PAYMENT FAILED - ', { invoice, data: request, error: e });
					saveData.paidAmount = 0;
					saveData.paid = false;
					saveData.failureMessage = message;
					saveData.invoiceStatus = paymentFailedStatus;
					saveData.invoiceStatusId = paymentFailedStatus.id;
					saveData.securityDepositStatusId = paymentFailedStatus.id;
					if (inputInvoiceData.reservation) {
						saveData.reservation!.status = ReservationStatus.DELETED;
					}
					await this.invoiceRepository.save({ id: inputInvoiceData.id, ...saveData });
					await this._sendEmail(inputInvoiceData.id);
					throw e;
				}
			} else if (request.isWebhook) {
				saveData.processDate = payDate.format();
				await this.invoiceRepository.save({ ...saveData });
				if (requestedByUser) await this._saveReservation(inputInvoiceData.id, { ...request, takePayment }, requestedByUser);
				return true;
			}

			saveData.processDate = payDate.format();
			saveData.paymentMode = 1; //card
			saveData.securityDepositStatus = (await this._getSecurityStatusByName('Paid')) || undefined;

			saveData.items = await Promise.all(
				inputInvoiceData.items.map(async (invoiceItem: InvoiceItemEntity) => {
					const cloneItem = invoiceItem;
					cloneItem.paid = true;
					cloneItem.payDate = payDate.format();
					cloneItem.paidAmount = invoiceItem.price2;
					cloneItem.paidAmount =
						((invoiceItem.price2 / 100) * invoiceItem.tax + invoiceItem.price2) * invoiceItem.quantity !== 0 ? invoiceItem.quantity : 1;
					return this.invoiceItemRepository.save(cloneItem);
				})
			);

			await this.invoiceRepository.save({ ...saveData, id: inputInvoiceData.id });

			if (takePayment && requestedByUser && !invoice.paymentMode) {
				const savedSubscription = await this.subscriptionRepository.findOne({
					where: { spaceId: invoice.spaceId, venueId: invoice.venueId, status: SubscriptionStatus.ACTIVE, takePayment: false },
				});
				if (savedSubscription) {
					await this.stripeService.createSubscription({
						createdById: requestedByUser.id,
						subscriptionId: savedSubscription.id,
						reservationId: invoice.reservationId,
						spaceId: invoice.spaceId,
						venueId: invoice.venueId,
						userId: invoice.userId,
						brandId: invoice.brandId,
						invoiceId: invoice.id,
						invoiceNumber: invoice.invoiceNumber,
						teamId: invoice.teamId,
						endDate: dayjs(savedSubscription.endDate).utc().unix(),
						markAsPaid: "markAsPaid"
					});

					await this.subscriptionRepository.update(savedSubscription.id, { takePayment: true });
				}
			}

			if (!inputInvoiceData.reservation && inputInvoiceData.space && requestedByUser) {
				await this._saveReservation(inputInvoiceData.id, { ...request, takePayment }, requestedByUser);
			} else if (inputInvoiceData.invoiceStatus?.name === 'Upcoming') {
				await this._saveUpcoming(inputInvoiceData.id);
			}

			if (inputInvoiceData.space) await this._updateUserPrivatePackages(inputInvoiceData.space.id, user.id);
			if (inputInvoiceData.space.spaceType.logicType !== SpaceTypeLogicType.MONTHLY) await this._sendEmail(inputInvoiceData.id);
			return true;
		} else {
			saveData.payDate = dayjs().format();
			saveData.paid = false;
			saveData.subTotal = inputInvoiceData.subTotal + inputInvoiceData.tax;
			saveData.paidAmount = inputInvoiceData.subTotal + inputInvoiceData.tax;
			saveData.invoiceStatus = (await this._getStatusByName('New')) || undefined;
			saveData.securityDepositStatus = (await this._getSecurityStatusByName('New')) || undefined;
		}

		saveData.processDate = payDate.format();

		await this.invoiceRepository.save({ ...saveData, id: inputInvoiceData.id });

		// if (inputInvoiceData.subTotal === 0) {
		// 	saveData.invoiceStatus = (await this._getStatusByName('Paid')) || undefined;
		// }

		if (!takePayment || !brand!.chargeCustomer) {
			saveData.invoiceStatus = (await this._getStatusByName('New')) || undefined;
			saveData.securityDepositStatus = (await this._getSecurityStatusByName('New')) || undefined;
		}

		if (!inputInvoiceData.reservation && inputInvoiceData.space && requestedByUser) {
			await this._saveReservation(inputInvoiceData.id, { ...request, takePayment }, requestedByUser);
		} else if (inputInvoiceData.invoiceStatus?.name === 'Upcoming') {
			await this._saveUpcoming(inputInvoiceData.id);
		}

		saveData.items = await Promise.all(
			inputInvoiceData.items.map(async (invoiceItem: InvoiceItemEntity) => {
				const cloneItem = invoiceItem;
				cloneItem.paid = true;
				cloneItem.payDate = payDate.format();
				cloneItem.paidAmount = 0;
				return this.invoiceItemRepository.save(cloneItem);
			})
		);

		await this.invoiceRepository.save({ ...saveData, id: inputInvoiceData.id });
		if (inputInvoiceData.space) await this._updateUserPrivatePackages(inputInvoiceData.space.id, user.id);
		return true;
	}

	/**
	 * Get invoice list with filter.
	 * @param {QueryInvoiceDto} params - Invoice params
	 */
	async list(params: QueryInvoiceDto): Promise<[SingleInvoiceWebResp[], number]> {
		const {
			userId,
			venueId,
			spaceId,
			spaceTypeIds,
			spaceTypeId,
			invoiceStatusIds,
			spaceIds,
			venueIds,
			limit = 10,
			offset = 0,
			sortByReservations = false,
			teamId,
			brandId,
			processDate,
			isSecuritydeposit,
			dateFrom,
			dateTo
		} = params;

		let query = MainDataSource.getRepository(InvoiceEntity)
			.createQueryBuilder('Invoice')
			.addSelect('Invoice.createdAt')
			.addSelect('Invoice.refundDate')
			.addSelect('Invoice.updatedAt')
			.leftJoinAndSelect('Invoice.space', 'space')
			.leftJoinAndSelect('Invoice.providerData', 'providerData')
			.leftJoinAndSelect('space.spaceType', 'spaceType')
			.leftJoinAndSelect('Invoice.venue', 'venue')
			.leftJoinAndSelect('Invoice.subscription', 'subscription')
			.leftJoinAndSelect('Invoice.reservation', 'reservation')
			.leftJoinAndSelect('Invoice.createdBy', 'createdBy')
			.leftJoinAndSelect('reservation.createdBy', 'reservationCreatedBy')
			.leftJoinAndSelect('reservationCreatedBy.brand', 'brands')
			.leftJoinAndSelect('brands.logo', 'logo')
			.leftJoinAndSelect('reservation.reservedTo', 'reservedTo')
			.leftJoinAndSelect('reservedTo.brand', 'brand')					
			.leftJoinAndSelect('Invoice.invoiceStatus', 'invoiceStatus')
			.leftJoinAndSelect('Invoice.paymentMode', 'paymentMode')
			.leftJoinAndSelect('venue.venueAdmins', 'venueAdmins')
			.leftJoinAndSelect('venueAdmins.photo', 'photo')
			.where('Invoice.invoiceNumber IS NOT NULL')
			.queryAndWhere(`Invoice.invoiceStatusId IN (:...invoiceStatusIds)`, { invoiceStatusIds })
			.queryAndWhere(`space.spaceTypeId IN (:...spaceTypeIds)`, { spaceTypeIds })
			.queryAndWhere(`Invoice.spaceId IN (:...spaceIds)`, { spaceIds })
			.queryAndWhere(`Invoice.venueId IN (:...venueIds)`, { venueIds })
			.queryAndWhere(`Invoice.userId = :userId`, { userId })
			.queryAndWhere(`space.spaceTypeId = :spaceTypeId`, { spaceTypeId })
			.queryAndWhere(`Invoice.teamId = :teamId`, { teamId })
			.queryAndWhere(`Invoice.brandId = :brandId`, { brandId })
			.queryAndWhere(`Invoice.venueId = :venueId`, { venueId })
			.queryAndWhere(`Invoice.spaceId = :spaceId`, { spaceId })
			.limit(Number(limit))
			.offset(Number(offset));
		
		if (userId && !teamId) {
			const teams = await MainDataSource.getRepository(TeamEntity).find({
				where: { teamLeadId: Number(userId) },
			});

			if (teams.length) {
				query = query.orWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						qb.where('Invoice.invoiceNumber IS NOT NULL');

						if (teams.length > 0) {
							qb.andWhere(`Invoice.teamId IN (:...teamIds)`, { teamIds: teams.map((t) => t.id) });							
						}

						if (invoiceStatusIds && invoiceStatusIds.length > 0) {
							qb.andWhere(`Invoice.invoiceStatusId IN (:...invoiceStatusIds)`, { invoiceStatusIds });
						}
					})
				);
			}
		}
		if (dateFrom && dateTo) {
			query = query
				.andWhere('reservation.hoursFrom >= :start', { start: dayjs(dateFrom).startOf('day').format() })
				.andWhere('reservation.hoursFrom < :end', { end: dayjs(dateTo).endOf('day').format() });
		}
		if(isSecuritydeposit)
		{
			query.andWhere('space.securityDepositPrice > 0');
		}

		let items, count;

		if (sortByReservations) {
			const genDateOrderBy = (status: string) => `CASE
				WHEN "reservation"."status" = '${status}' AND "reservation"."hoursFrom"::date = CURRENT_DATE::date THEN "reservation"."hoursFrom"
				WHEN "reservation"."status" = '${status}' AND "reservation"."hoursFrom"::timestamp > CURRENT_DATE::timestamp THEN "reservation"."hoursFrom"
			END`;

			query = query
				.andWhere('Invoice.spaceId IS NOT NULL')
				.andWhere('Invoice.reservationId IS NOT NULL')
				.andWhere(`spaceType.logicType != :infoLogicType`, { infoLogicType: SpaceTypeLogicType.INFO })
				.andWhere(`spaceType.logicType != :monthlyLogicType`, { monthlyLogicType: SpaceTypeLogicType.MONTHLY })
				// .andWhere(`spaceType.logicType != :eventLogicType`, { eventLogicType: SpaceTypeLogicType.EVENT })

				.addOrderBy(
					`CASE
				WHEN "reservation"."status" = 'active' THEN 1
				WHEN "reservation"."status" != 'active' THEN 2
			END`
				)
				.addOrderBy(genDateOrderBy('active'))
				.addOrderBy('"reservation"."hoursFrom"', 'DESC');

			[items, count] = await query.getManyAndCount();
		} else {
			[items, count] = await query
				.queryAndWhere(`Invoice.processDate >= :processDate`, { processDate })
				.orderBy('Invoice.updatedAt', 'DESC')
				.getManyAndCount();
		}

		const returnItems: SingleInvoiceWebResp[] = await Promise.all(
			items.map(async (item) => {
				const [space, venue, user] = await Promise.all([
					MainDataSource.getRepository(SpaceEntity).findOne({
						where: { id: item.spaceId },
						relations: ['photos'],
						cache: true,
					}),
					MainDataSource.getRepository(VenueEntity).findOne({
						where: { id: item.venueId },
						relations: ['photos'],
						cache: true,
					}),			
					MainDataSource.getRepository(UserEntity).findOne({
						where: { id: item.reservation?.reservedTo?.id },
						relations: ['photo'],
						cache: true,
					}),	
				]);

				if (space) item.space.photos = space.photos;

				if (venue) item.venue.photos = venue.photos;
				
				if( venue && item.venue.accessCustom){	
					const venueData = await MainDataSource.getRepository(VenueEntity).findOneOrFail({
						where: { id:venue.id },
						relations: ['accessCustomData']
					});
					item.venue.accessCustomData = venueData.accessCustomData;
					}
					
				if (user && item.reservation && item.reservation?.reservedTo) item.reservation.reservedTo.photo = user.photo;

				const invoiceItems = await MainDataSource.getRepository(InvoiceItemEntity).find({ where: { invoiceId: item.id } });

				return { ...item, items: invoiceItems };
			}) // end of map function
		); // end of promise all statement

		return [await Promise.all(returnItems.map(async (invoice) => await this._updateObjWithStripeInvoice(invoice))), count];
	}

	/**
	 * Delete invoice
	 * @param {string} id - Invoice ID
	 * @returns {ForbiddenResponse} - Deleted reservation data
	 */
	delete(id: string): ForbiddenResponse {
		throw new ForbiddenResponse();
	}
	public async sendMembershipEmail(templateTypeName: string, logicType : string, packageShow :string, chargeType : string) : Promise<boolean>{
		try{
		const isStopMembershipEmails = await this.features.isEnabled(FeatureFlag.stopFreeMembershipEmails);
		if(isStopMembershipEmails){
			loggerHelper.info('templateTypeName invoice.service.ts 2738- '+ templateTypeName );
			switch(templateTypeName){
				case 'Booking Confirmation' :
				case 'Booking space confirmation' :
				case 'Booking confirmation for admin' :
				case 'Booking hourly space confirmation' :
				case 'Booking hourly confirmation for admin' :
				case 'Check-in space confirmation' :
				case 'Check-in confirmation for admin' :
				case 'Check-out space confirmation':
				case 'Check-out confirmation for admin' :
				case 'Booking hourly confirmation for admin' :
				case 'Change reservation':
				case 'Change reservation for admin':
				case 'Upcoming invoice paid':
				case 'Upcoming invoice paid for admin':	
				if(logicType == SpaceTypeLogicType.MONTHLY||(packageShow == PackageShow.TEAM_MEMBERSHIP  || packageShow == PackageShow.MEMBERSHIP)
				&& (logicType != SpaceTypeLogicType.HOURLY && logicType != SpaceTypeLogicType.MINUTELY
				&& logicType != SpaceTypeLogicType.DAILY && logicType != SpaceTypeLogicType.WEEKLY) ){
					return false;
				}
				if((logicType == SpaceTypeLogicType.MONTHLY || packageShow == PackageShow.TEAM_MEMBERSHIP  || packageShow == PackageShow.MEMBERSHIP) && chargeType == ChargeType.FREE){
					return false;
				}
					return true;
				default:
					return true;
				}				
		}		
		return true;	 
	}
	catch(e){
			loggerHelper.error('ERROR IN DETERMINING SEND EMAIL - ', e);
			return true;
		}
	}
}

