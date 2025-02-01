import { Between, Brackets, In, Not, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import SpaceEntity from '@entity/space.entity';
import SpaceStatus from 'dd-common-blocks/dist/type/SpaceStatus';
import loggerHelper from '@helpers/logger.helper';
import { prepareImage, uploadToS3 , uploadVideoToS3} from '@helpers/s3';
import dayjs, { Dayjs } from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import dayjsutc from 'dayjs/plugin/utc';
import dayjstimezone from 'dayjs/plugin/timezone';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import ReservationEntity from '@entity/reservation.entity';
import ReservationStatus from 'dd-common-blocks/dist/type/ReservationStatus';
import SpacePinsOutputInterface from '../interface/space-pins-output.interface';
import UserEntity from '@entity/user.entity';
import SubscriptionEntity from '@entity/subscription.entity';
import EntityStatus from 'dd-common-blocks/dist/type/EntityStatus';
import PackageShow from 'dd-common-blocks/dist/type/PackageShow';
import { DEFAULT_BRAND_NAME, DOMAIN, MEDIA_URL } from '@src/config';
import SubscriptionService from '@services/subscription.service';
import AccessCustomDataEntity from '@entity/access-custom-data.entity';
import SpaceTypeLogicType from 'dd-common-blocks/dist/type/SpaceTypeLogicType';
import UserService from '@services/user.service';
import InvoiceEntity from '@entity/invoice.entity';
import { getMimeFromUrl } from 'dd-common-blocks';
import { getSpaceUrl } from '@utils/lib/space';
import VenueStatus from 'dd-common-blocks/dist/type/VenueStatus';
import InvoiceStatusEntity from '../entity/invoice-status.entity';
import BrandRoleType from 'dd-common-blocks/dist/type/BrandRoleType';
import BaseService from '@services/base.service';
import { ForbiddenResponse } from '@utils/response/forbidden.response';
import { NotFoundErrorResp } from '@utils/response/not-found.response';
import { ValidationErrorResp } from '@utils/response/validation-error.response';
import VenueEntity from '@entity/venue.entity';
import imageToBase64 from '@helpers/image-to-base64.helper';
import { Inject, Service } from 'typedi';
import MainDataSource from '../main-data-source';
import PaymentProvider from 'dd-common-blocks/dist/type/PaymentProvider';
import StripeService from '@services/stripe.service';
import Stripe from 'stripe';
import GetSpaceAvailabilityDto from '@src/dto/get-space-availability.dto';
import { SuccessResponseInterface } from '@src/utils/response/success.response';
import { FeatureFlag } from '../utils/feature-flag';
import ChargeType from 'dd-common-blocks/dist/type/ChargeType';
import PackageVenuesEntity from '@src/entity/package-venues.entity';
import { DefaultDropdeskPackage, DefaultDropdeskPackageId } from '@src/utils/constant';
import BrandEntity from '@src/entity/brand.entity';
import type SpaceFilterRequest from '@src/dto/space-filter-request';
import winstonLogger from '@src/utils/helpers/winston-logger';

dayjs.extend(customParseFormat);
dayjs.extend(isBetween);
dayjs.extend(dayjsutc);
dayjs.extend(dayjstimezone);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

interface AvailableDateItemInterface {
	value: string;
	isMinTime: boolean;
	reserved: boolean;
}

interface AvailableDateWebInterface {
	date: string;
	open: boolean;
	reserved: boolean;
	from: string;
	to: string;
	items: AvailableDateItemInterface[];
}

interface SpaceWebResponseInterface extends SpaceEntity {
	stripeData?: Stripe.Product[];
}

/**
 * Handle all actions with Space.
 * @module SpaceService
 * @category Services
 */
@Service()
export default class SpaceService extends BaseService {
	@Inject()
	stripeService: StripeService;

	private venueRepo = MainDataSource.getRepository(VenueEntity);
	private spaceRepo = MainDataSource.getRepository(SpaceEntity);

	constructor(
		@Inject(() => SubscriptionService)
		private subscriptionService: SubscriptionService
	) {
		super();
		this.entity = SpaceEntity;
	}

	/**
	 * Return single space with relations by ID:
	 * - [photos]{@link FileEntity}
	 * - [spaceType]{@link SpaceTypeEntity}
	 * - [venue]{@link VenueEntity}
	 * - [venue.brand]{@link BrandEntity}
	 * - [reservation]{@link ReservationEntity}
	 * - [amenities]{@link SpaceAmenityEntity}
	 * - [amenities.amenity]{@link AmenityEntity}
	 * - [creditHours]{@link SpaceCreditHoursEntity}
	 * - [eventData]{@link EventDataEntity}
	 *
	 * @param {number} id - Space ID
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<SpaceEntity | null>}
	 */
	async single(id: number, requestedByUser?: UserEntity): Promise<SpaceWebResponseInterface | null> {
		const space: SpaceWebResponseInterface = await this.spaceRepo.findOneOrFail({
			where: { id },
			relations: [
				'photos',
				'spaceType',
				'packageBrands',
				'providerData',
				'packageVenues',
				'packageSpaceTypes',
				'packageVenueTypes',
				'amenities',
				'amenities.amenity',
				'eventData',
				'creditHours',
				'venue',
				'subCategories',
				'packageSubCategories',
				'venue.brand',				
				'venue.photos',
				'venue.accessCustomData',
				'venue.venueAdmins',	
				'venue.venueAdmins.photo',
				'venue.brand.brandCategories',
				'venue.brand.brandCategories.subCategories',	
			],
		});

		space.reservation = await MainDataSource.getRepository(ReservationEntity).find({
			where: { spaceId: space.id, status: ReservationStatus.ACTIVE },
		});

		if (requestedByUser && requestedByUser.isAdmin) {
			const item = await this.stripeService.getProductBySpaceId(space.id, requestedByUser.id);
			if (!space.stripeData) space.stripeData = [];
			if (item) space.stripeData.push(item);
		}

		return space;
	}

	async getSingleByAlias(spaceAlias: string, venueAlias: string): Promise<SpaceEntity | null> {
		const space = await MainDataSource.getRepository(SpaceEntity).findOneOrFail({
			where: { alias: spaceAlias, venue: { alias: venueAlias }, status: Not(SpaceStatus.DELETED) },
			relations: [
				'photos',
				'spaceType',
				'packageBrands',
				'packageVenues',
				'packageSpaceTypes',
				'packageVenueTypes',
				'amenities',
				'amenities.amenity',
				'eventData',
				'creditHours',
				'subCategories',
				'packageSubCategories',
				'venue',
				'venue.brand',
				'venue.photos',
				'venue.accessCustomData',
				'venue.venueAdmins',	
				'venue.venueAdmins.photo',	
				'venue.brand.brandCategories',	
				'venue.brand.brandCategories.subCategories',	
			],
		});

		space.reservation = await MainDataSource.getRepository(ReservationEntity).find({
			where: { spaceId: space.id, status: ReservationStatus.ACTIVE },
		});

		return space;
	}

	/**
	 * Creates new space.
	 * @param {Partial<SpaceEntity>} data - Partial space data
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<SpaceEntity | undefined>}
	 */
	async create(data: Partial<SpaceEntity>, requestedByUser: UserEntity): Promise<SpaceEntity | undefined> {
		let allowedToCreate = false;
		if (requestedByUser?.isSuperAdmin()) allowedToCreate = true;

		const spaceVenue = await this.venueRepo.findOneOrFail({ where: { id: data.venueId } });

		if (
			(requestedByUser?.role?.roleType === BrandRoleType.ADMIN || requestedByUser?.role?.roleType === BrandRoleType.VENUE_ADMIN) &&
			requestedByUser?.brandId === spaceVenue.brandId
		)
			allowedToCreate = true;

		if (!allowedToCreate) throw new ForbiddenResponse();

		const cloneData = data;

		cloneData.updatedById = requestedByUser.id;

		const attachments: string[] = cloneData.uploadAttachments || [];
		if (cloneData.imageUrls) {
			await Promise.all(
				cloneData.imageUrls.map(async (url) => attachments.push(`data:${getMimeFromUrl(url)};base64,${await imageToBase64(url)}`))
			);
		}

		const { packageBrands } = cloneData;
		const { packageSpaceTypes } = cloneData;

		if (!cloneData.status) {
			cloneData.status = SpaceStatus.PUBLISH;
		}

		delete cloneData.packageSpaceTypes;
		delete cloneData.uploadAttachments;
		// delete cloneData.amenities;

		const savedSpace = await MainDataSource.getRepository(SpaceEntity).save(MainDataSource.getRepository(SpaceEntity).create(cloneData));

		/**
		 * Space package types visibility
		 */
		if (packageSpaceTypes && packageSpaceTypes.length) {
			savedSpace.packageSpaceTypes = packageSpaceTypes;
			// await MainDataSource.getRepository(SpaceEntity).save(savedSpace);
		}

		if (packageBrands && packageBrands.length) {
			savedSpace.packageBrands = packageBrands;
			// await MainDataSource.getRepository(SpaceEntity).save(savedSpace);
		}

		if (attachments && attachments.length) {
			savedSpace.photos = [];
			await Promise.all(
				attachments.map(async (attachment) => {
					try {
						if(!attachment.includes('video')){
						const image64 = await prepareImage(attachment, 1024);
						const file = await uploadToS3(image64, 'space', String(savedSpace.id), String(new Date().valueOf()));
						savedSpace.photos.push(file);
						}
					} catch (e) {
						loggerHelper.error('image saving failed - ', e);
					}
				})
			);
			const videoList = attachments.filter(a => a.includes('video'));
			if(videoList.length > 0){
				try{
				for(const attachment of videoList){
					const videofile = await uploadVideoToS3(attachment, 'space', String(savedSpace.id), String(new Date().valueOf()));
					savedSpace.photos.push(videofile);
				} 
			}
				catch (e) {
					loggerHelper.error('video saving failed - ', e);
				}
			}	
		}

		// get created space with relations
		const space = await MainDataSource.getRepository(SpaceEntity).findOneOrFail({
			where: { id: savedSpace.id },
			relations: ['photos', 'venue', 'spaceType', 'amenities'],
		});

		await this.stripeService.createSpaceProduct({ userId: requestedByUser.id, createdById: requestedByUser.id, spaceId: space.id });

		await Promise.all(
			space.amenities.map(async (sa) => {
				await this.stripeService.createSpaceAmenityProduct({ userId: requestedByUser.id, spaceAmenityId: sa.id });
			})
		);

		return MainDataSource.getRepository(SpaceEntity).save(savedSpace);
	}

	/**
	 * Updates single space by ID
	 * @param {number} id - Space ID
	 * @param {Partial<SpaceEntity>} data - Partial space data
	 * @param {UserEntity} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<SpaceEntity | undefined>}
	 */
	async update(id: number, data: Partial<SpaceEntity>, requestedByUser: UserEntity): Promise<SpaceEntity | undefined> {
		const { reservation, ...cloneData } = data;
		const space = await MainDataSource.getRepository(SpaceEntity).findOneOrFail({
			where: { id },
			relations: ['photos', 'venue', 'spaceType', 'providerData', 'creditHours', 'amenities', 'amenities.providerData'],
		});
		if (!space._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		// fix if admin publishing space with quantity = 0
		if (
			space.status !== SpaceStatus.PUBLISH &&
			cloneData.status === SpaceStatus.PUBLISH &&
			space.quantity === space.usedQuantity &&
			space.quantity - space.usedQuantity === 0
		) {
			cloneData.usedQuantity = 0;
			if (cloneData.quantity === 0) cloneData.quantity = 1;
		}

		const attachments: string[] = cloneData.uploadAttachments || [];
		if (cloneData.imageUrls) {
			await Promise.all(
				cloneData.imageUrls.map(async (url) => attachments.push(`data:${getMimeFromUrl(url)};base64,${await imageToBase64(url)}`))
			);
		}

		delete cloneData.uploadAttachments;

		if (typeof cloneData.price === 'undefined' || cloneData.price === null || cloneData.chargeType === ChargeType.FREE) cloneData.price = 0;
		if (typeof cloneData.securityDepositPrice === 'undefined' || !cloneData.securityDeposit || cloneData.securityDepositPrice === null) cloneData.securityDepositPrice = 0;
		if (typeof cloneData.roundHours === 'undefined' || cloneData.roundHours === null) cloneData.roundHours = 0;

		if (attachments && attachments.length) {
			await Promise.all(
				attachments.map(async (attachment) => {
					try {
						if(!attachment.includes('video')){
						const image64 = await prepareImage(attachment, 1024);
						const file = await uploadToS3(image64, 'space', String(id), String(new Date().valueOf()));
						cloneData.photos?.push(file);
						}
					} catch (e) {
						loggerHelper.error('image saving failed - ', e);
					}
				})
			);
			const videoList = attachments.filter(a => a.includes('video'));
			if(videoList.length > 0){
				try{
				for(const attachment of videoList){
					const videofile = await uploadVideoToS3(attachment, 'space', String(id), String(new Date().valueOf()));
					cloneData.photos?.push(videofile);
				} 
			}
				catch (e) {
					loggerHelper.error('video saving failed - ', e);
				}
			}	
		}

		cloneData.renewedAt = null;

		cloneData.lastUsed = new Date();

		await MainDataSource.getRepository(SpaceEntity).save({ ...space, ...cloneData });

		await this.saveSpaceToStripe({ spaceId: id, oldPrice: space.price, oldSecurityPrice: space.securityDepositPrice }, requestedByUser);

		return { ...space, ...cloneData };
	}

	async _baseList(params: SpaceFilterRequest,isFromWP:boolean, requestedByUser?: UserEntity | undefined, requestForMap?:boolean): Promise<SelectQueryBuilder<SpaceEntity>> {
		const {
			alias,
			venueAlias,
			spaceTypeId,
			capacity,
			quantity,
			searchString,
			amenities,
			chargeType,
			chargeTypes,
			brandId,
			excludeIds,
			spaceTypeIds,
			subCategoryIds,
			//brandCategoryId,
			latitude,
			longitude,
			withReservations,
			withPackageSpaceTypes,
			withPackageVenueTypes,
			withPackageVenues,
			withPackageBrands,
			withCreatedBy,
			withUpdatedBy,
			withAmenities,
			withCreditHours,
			address,
			venueStatus = VenueStatus.PUBLISH,
			radius = 100000,
		} = params;
		const isBrandCatSubCat = await this.features.isEnabled(FeatureFlag.brandCategoryFlowEnabled);
		let { venueId, status, packageShow } = params;

		let user: UserEntity | null = null;
		let userBoughtPackagesIds: string[] | undefined;

		let brandIdArr: number[] = brandId ? [Number(brandId)] : [];
		let venueIdArr: number[] = venueId ? [Number(venueId)] : [];
		let venueTypesIdArr: number[] = [];
		let spaceTypesIdArr: number[] = spaceTypeIds || [];
		let subCategoryIdsArr: number[] = subCategoryIds || [];
		const subscriptionsSubCatBase: number[] = [];

		let userHaveSubscriptionBrands = false;

		let allowedPublicSpaces = false;

		if (!alias) {
			if (requestedByUser?.id) {
				user = await MainDataSource.getRepository(UserEntity)
					.createQueryBuilder('user')
					.leftJoinAndSelect('user.adminVenues', 'adminVenues')
					.leftJoinAndSelect('user.role', 'role')
					.leftJoinAndSelect('user.brand', 'brand')
					.where('user.id = :userId', { userId: requestedByUser.id })
					.getOne();

				if (user) {
					user.subscriptions = await UserService._getSubscriptionsByUserId(user.id, [
						'spaceTypes',
						'brands',
						'venues',
						'space',
						'space.packageVenueTypes',
						'space.packageSubCategories',
						'venueTypes',
						'subCategories',
					]);

					const publicAllowedSub = user.subscriptions.find((s) => s.allowPublicSpaces);
					allowedPublicSpaces = !!publicAllowedSub;

					// venue admin
					if (user.role?.roleType === BrandRoleType.VENUE_ADMIN && user.adminVenues && user.adminVenues.length) {
						if (!venueId) {
							venueIdArr = user.adminVenues.map((v) => v.id);
						} else {
							// simple check if venue admin can view this venues packages
							const isUserAllowedToViewVenue = user.adminVenues.find((v) => v.id === Number(venueId));
							if (!isUserAllowedToViewVenue) venueId = undefined;
						}
					}

					// exclude team membership packages
					userBoughtPackagesIds = user.subscriptions
						? user.subscriptions
								.filter((s) => ![PackageShow.TEAM_MEMBERSHIP, PackageShow.MEMBERSHIP].includes(s.space!.packageShow))
								.map((s) => String(s.spaceId))
						: [];

					if (!user.isAdmin && !user.isSuperAdmin()) {
						brandIdArr = [user.brandId];
						packageShow = [PackageShow.MEMBERS_ONLY];

						if (allowedPublicSpaces) packageShow.push(PackageShow.PUBLIC);

						status = SpaceStatus.PUBLISH;

						if (user.subscriptions && user.subscriptions.length) {
							const subscriptionsSpaceTypes: number[] = [];
							const subscriptionsSubCat: number[] = [];

							user.subscriptions.forEach((s: SubscriptionEntity) => {
								if (s.spaceTypes && s.spaceTypes.length) {
									s.spaceTypes.forEach((st) => {
										if (!subscriptionsSpaceTypes.includes(st.id)) subscriptionsSpaceTypes.push(st.id);
									});
								}
								if (s?.subCategories?.length) {
									s.subCategories.forEach((st) => {
										if (!subscriptionsSubCat.includes(st.id)) subscriptionsSubCat.push(st.id);
									});
								}
								if (s.venueTypes && s.venueTypes.length) {
									venueTypesIdArr = [...venueTypesIdArr, ...s.venueTypes.map((st) => st.id)];
								}
								else if(s.space?.packageVenueTypes && s.space?.packageVenueTypes.length)
								{
									venueTypesIdArr = [...venueTypesIdArr, ...s.space?.packageVenueTypes.map((st) => st.id)];
								}
							});

							if (subscriptionsSpaceTypes.length && !isBrandCatSubCat) {								
								spaceTypesIdArr = [
									...spaceTypesIdArr,
									...(spaceTypesIdArr.length
										? spaceTypesIdArr.filter((stid) => subscriptionsSpaceTypes.map((st) => Number(st)).includes(Number(stid)))
										: subscriptionsSpaceTypes),
								];
							}
							
								if (subscriptionsSubCat.length) {
									 subCategoryIdsArr = [
								 	...subCategoryIdsArr,
								 	...(subCategoryIdsArr.length
								 		? subCategoryIdsArr.filter((stid) => subscriptionsSubCat.map((st) => Number(st)).includes(Number(stid)))
								 		: subscriptionsSubCat),
								 ];

								 subscriptionsSubCatBase.push(...subscriptionsSubCat);
								}
						} else if (user.spaceId) {
							const space = await MainDataSource.getRepository(SpaceEntity).findOneOrFail({ where: { id: user?.spaceId } });
							if (space && space.name === DefaultDropdeskPackage && space.id === DefaultDropdeskPackageId) {
								packageShow = [space.packageShow];
								venueIdArr.push(space.venueId);
							}
						}
					}
				}
			} else {
				packageShow = [PackageShow.PUBLIC];
			}
		}

		let query = MainDataSource.getRepository(SpaceEntity)
			.createQueryBuilder('Space')
            if (longitude && latitude) {
                query = query.addSelect(`ST_Distance(venue.coordinates, ST_MakePoint(${longitude}, ${latitude}))`, 'distance')
            }
			query = query.leftJoinAndSelect('Space.spaceType', 'spaceType')
			.leftJoinAndSelect('Space.photos', 'photos')
			.leftJoinAndSelect('Space.eventData', 'eventData')
			.leftJoinAndSelect('Space.subCategories', 'subCategories')
			.leftJoinAndSelect('Space.venue', 'venue')
			.leftJoinAndSelect('venue.brand', 'brand')
			.leftJoinAndSelect('brand.brandCategories', 'brandCategories')
			.leftJoinAndSelect('venue.photos', 'venuePhotos')
            .leftJoinAndSelect('venue.logo', 'venueLogo')
			.leftJoinAndSelect('venue.accessCustomData', 'accessCustomData')
			.leftJoinAndSelect('accessCustomData.venue', 'accessCustomDataVenue');

		if (withReservations) {
			query = query
				.leftJoinAndSelect('Space.reservation', 'reservation', `reservation.status = :reservationStatus`, {
					reservationStatus: ReservationStatus.ACTIVE,
				})
				.loadRelationCountAndMap('Space.reservationCount', 'Space.reservation');
				winstonLogger.info('SpaceService._baseList: ' , query.getQuery());
		}

		if (withCreditHours) {
			query = query.leftJoinAndSelect('Space.creditHours', 'creditHours');
		}

		if (withPackageSpaceTypes) {
			query = query.leftJoinAndSelect('Space.packageSpaceTypes', 'packageSpaceTypes');
		}

		if (withPackageVenueTypes) {
			query = query.leftJoinAndSelect('Space.packageVenueTypes', 'packageVenueTypes');
		}

		if (withPackageBrands) {
			query = query.leftJoinAndSelect('Space.packageBrands', 'packageBrands');
		}

		if (withPackageVenues) {
			query = query.leftJoinAndSelect('Space.packageVenues', 'packageVenues');
		}

		if (withAmenities && !isFromWP) {
			query = query.leftJoinAndSelect('Space.amenities', 'amenities').leftJoinAndSelect('amenities.amenity', 'amenities.amenity');
		}

		if(((!user?.isAdmin && !user?.isSuperAdmin()) || !user) && isBrandCatSubCat && !isFromWP)
			{
				query = query.leftJoinAndSelect('venue.venueType', 'venueType')
				query = query.leftJoinAndSelect('Space.amenities', 'amenities').leftJoinAndSelect('amenities.amenity', 'amenityData');

			}

		if (withCreatedBy) {
			query = query.leftJoinAndSelect('Space.createdBy', 'createdBy');
		}

		if (withUpdatedBy) {
			query = query.leftJoinAndSelect('Space.updatedBy', 'updatedBy');
		}

		const getLocationCoordsQuery = (): [string, any] => {
			return [
				'ST_Distance(venue.coordinates, ST_SetSRID(ST_GeomFromGeoJSON(:origin), ST_SRID(venue.coordinates))) <= :radius',
				{ origin: `{"type":"Point","coordinates":["${longitude}","${latitude}"]}`, radius },
			];
		};

		if(((!user?.isAdmin && !user?.isSuperAdmin()) || !user) && isBrandCatSubCat && !isFromWP)
            {
                if (searchString !== '') {
                    query.where(
                        new Brackets(qb => {
                            qb.where(`LOWER(Space.name) LIKE LOWER(:searchString)`, { searchString: `%${searchString}%` })
                              .orWhere(`LOWER(amenityData.name) LIKE LOWER(:searchString)`, { searchString: `%${searchString}%` })
                              .orWhere(`LOWER(venueType.name) LIKE LOWER(:searchString)`, { searchString: `%${searchString}%` });
                        })
                    );
                }
                query.andWhere(amenities?.length ? `amenityData.name IN (:...amenities)` : '1=1', { amenities })    

                if (params.price) {
                    query = query
                        .andWhere('Space.price >= :start', { start: params.price[0] })
                        .andWhere('Space.price < :end', { end: params.price[1] });
                }
                if (params.capacityValue) {
                    query = query
                        .andWhere('capacity >= :start', { start: (params.capacityValue[0]) })
                        .andWhere('capacity < :end', { end: (params.capacityValue[1])});
                }
                    if(params.spaceAvailibilityDays === "true")
                    query = query.andWhere("venue.accessCustom = :accessCustom", { accessCustom: true });
                }
                else
                {
                    query.where(searchString ? `LOWER(Space.name) LIKE LOWER(:searchString)` : '1=1', { searchString: `%${searchString}%` })
                }
				

			query.andWhere(brandIdArr.length ? `venue.brandId IN (:...brandIdArr)` : '1=1', { brandIdArr })
			.andWhere(venueIdArr.length ? `Space.venueId IN (:...venueIdArr)` : '1=1', { venueIdArr })
			.andWhere(venueTypesIdArr.length ? `venue.venueTypeId IN (:...venueTypesIdArr)` : '1=1', { venueTypesIdArr })						
			.queryAndWhere(`Space.alias = :alias`, { alias })
			.queryAndWhere(`venue.alias = :venueAlias`, { venueAlias })
			.queryAndWhere(`Space.status = :status`, { status })
			.queryAndWhere(`venue.status = :venueStatus`, { venueStatus })
			.queryAndWhere(`Space.spaceType = :spaceTypeId`, { spaceTypeId })
			.queryAndWhere(`Space.id NOT IN (:...excludeIds)`, { excludeIds })
			.queryAndWhere(`Space.capacity = :capacity`, { capacity })
			.queryAndWhere(`Space.quantity = :quantity`, { quantity })
			.queryAndWhere(`Space.chargeType = :chargeType`, { chargeType })
			.queryAndWhere(`Space.chargeType IN (:...chargeTypes)`, { chargeTypes })
			.andWhere(address ? `LOWER(venue.address) LIKE LOWER(:address)` : '1=1', { address: `%${address}%` })
			.queryAndWhere(`Space.packageShow IN (:...packageShow)`, { packageShow });

			winstonLogger.info('SpaceService._baseList modified: ' , query.getQuery());
			if(!requestedByUser?.isAdmin && user?.subscriptions?.length)
			{
				const packageVenue = await MainDataSource.getRepository(PackageVenuesEntity).find({
					where: { spaceId: user?.subscriptions[0].spaceId },
					select: ['venueId'],
					});
			if(user.subscriptions[0].space?.packageShow !==PackageShow.PUBLIC && packageVenue.length>0 && !requestForMap)
			{
			query.andWhere("Space.venueId IN (:...ids)", { ids: [] })
			}
		}
		
		//if user's subscription have no check on sub cat, user selected all, or user send the same sbcategory that he have on subs
		if (isBrandCatSubCat && (subscriptionsSubCatBase.length == 0 || (subscriptionsSubCatBase.includes(subCategoryIdsArr[0]) || subCategoryIdsArr[0] === 0))){
			query = query.andWhere(subCategoryIdsArr.length ? `subCategories.id IN (:...subCategoryIdsArr)` : '1=1', { subCategoryIdsArr })			
		}

		if (!isBrandCatSubCat || !user){
			query = query.andWhere(spaceTypesIdArr.length ? `Space.spaceTypeId IN (:...spaceTypesIdArr)` : '1=1', { spaceTypesIdArr })
			
		}

		if (longitude && latitude && !venueAlias) {
			query = query.andWhere(getLocationCoordsQuery()[0], getLocationCoordsQuery()[1]);
		}

		const getBaseWhereQ = (qb: WhereExpressionBuilder): WhereExpressionBuilder => {
			let ret = qb


			if(((!user?.isAdmin && !user?.isSuperAdmin()) || !user) && isBrandCatSubCat && !isFromWP)
				{

                    if (searchString !== '') {
                        qb.where(
                            new Brackets(qbs => {
                                qbs.where(`LOWER(Space.name) LIKE LOWER(:searchString)`, { searchString: `%${searchString}%` })
                                  .orWhere(`LOWER(amenityData.name) LIKE LOWER(:searchString)`, { searchString: `%${searchString}%` })
                                  .orWhere(`LOWER(venueType.name) LIKE LOWER(:searchString)`, { searchString: `%${searchString}%` });
                            })
                        );
                    }
                    
                      qb.andWhere(amenities?.length ? `amenityData.name IN (:...amenities)` : '1=1', { amenities }) 
    
                    if (params.price) {
                        qb = qb
                            .andWhere('Space.price >= :start', { start: params.price[0] })
                            .andWhere('Space.price < :end', { end: params.price[1] });
                    }
                    if (params.capacityValue) {
                        qb = qb
                            .andWhere('capacity >= :start', { start: (params.capacityValue[0]) })
                            .andWhere('capacity < :end', { end: (params.capacityValue[1])});
                    }
					if(params.spaceAvailibilityDays === 'true')
                        qb = qb.andWhere("venue.accessCustom = :accessCustom", { accessCustom: true });
                }
                    else
                    {
                        qb.where(searchString ? `LOWER(Space.name) LIKE LOWER(:searchString)` : '1=1', { searchString: `%${searchString}%` })
                    }
				qb.andWhere(venueId ? `Space.venueId= :venueId` : '1=1', { venueId })
				.andWhere(alias ? `Space.alias = :alias` : '1=1', { alias })
				.andWhere(venueAlias ? `venue.alias = :venueAlias` : '1=1', { venueAlias })
				.andWhere(status ? `Space.status = :status` : '1=1', { status })
				.andWhere(venueStatus ? `venue.status = :venueStatus` : '1=1', { venueStatus })
				.andWhere(spaceTypeId ? `Space.spaceType = :spaceTypeId` : '1=1', { spaceTypeId })
				.andWhere(excludeIds ? `Space.id NOT IN (:...excludeIds)` : '1=1', { excludeIds })
				.andWhere(capacity ? `Space.capacity = :capacity` : '1=1', { capacity })
				.andWhere(quantity ? `Space.quantity = :quantity` : '1=1', { quantity })
				.andWhere(chargeType ? `Space.chargeType = :chargeType` : '1=1', { chargeType })
				.andWhere(chargeTypes ? `Space.chargeType IN (:...chargeTypes)` : '1=1', { chargeTypes });

				//if user's subscription have no check on sub cat, user selected all, or user send the same sbcategory that he have on subs
				if (isBrandCatSubCat && (subscriptionsSubCatBase.length == 0 || (subscriptionsSubCatBase.includes(subCategoryIdsArr[0]) || subCategoryIdsArr[0] === 0))){
					query.andWhere(subCategoryIds ? `subCategories.id IN (:...subCategoryIds)` : '1=1', { subCategoryIds })
				}

			if (longitude && latitude && !venueAlias) {
				ret = ret.andWhere(getLocationCoordsQuery()[0], getLocationCoordsQuery()[1]);
			}

			return ret;
		};

		if (user && !user.isAdmin && !user.isSuperAdmin()) {
			if (user.brand!.name === DEFAULT_BRAND_NAME) {
				if (!userHaveSubscriptionBrands) {
					// add public packages from all brands
					query = query.orWhere(
						new Brackets((qb: WhereExpressionBuilder) =>
							getBaseWhereQ(qb)
								.andWhere(`Space.packageShow=:p`, { p: PackageShow.PUBLIC })
								.andWhere(venueIdArr.length ? `Space.venueId IN (:...venueIdArr)` : '1=1', { venueIdArr })
								.andWhere(venueTypesIdArr.length ? `venue.venueTypeId IN (:...venueTypesIdArr)` : '1=1', { venueTypesIdArr })
								.andWhere(spaceTypesIdArr.length ? `Space.spaceTypeId IN (:...spaceTypesIdArr)` : '1=1', { spaceTypesIdArr })
						)
					);
				}
			} else if (allowedPublicSpaces) {
				query = query.orWhere(
					new Brackets((qb: WhereExpressionBuilder) =>
						getBaseWhereQ(qb)
							.andWhere(`Space.packageShow=:p`, { p: PackageShow.PUBLIC })
							.andWhere(spaceTypesIdArr.length ? `Space.spaceTypeId IN (:...spaceTypesIdArr)` : '1=1', { spaceTypesIdArr })
							
					)
				);
			} else {
				query = query.orWhere(
					new Brackets((qb: WhereExpressionBuilder) =>
						getBaseWhereQ(qb)
							.andWhere(`Space.packageShow=:p`, { p: PackageShow.PUBLIC })
							.andWhere(`venue.brandId = :userBrandId`, { userBrandId: user?.brandId })
							.andWhere(spaceTypesIdArr.length ? `Space.spaceTypeId IN (:...spaceTypesIdArr)` : '1=1', { spaceTypesIdArr })
							
					)
				);
			}

			if (Array.isArray(userBoughtPackagesIds) && userBoughtPackagesIds.length > 0) {
				// add packages user already bought
				query = query.orWhere(
					new Brackets((qb: WhereExpressionBuilder) =>
						getBaseWhereQ(qb)
							.andWhere(`Space.id IN (:...userBoughtPackagesIds)`, { userBoughtPackagesIds })
							.andWhere(packageShow ? `Space.packageShow IN (:...packageShow)` : '1=1', { packageShow })
							.andWhere(spaceTypesIdArr.length ? `Space.spaceTypeId IN (:...spaceTypesIdArr)` : '1=1', { spaceTypesIdArr })
					)
				);
			}
			//if user's subscription have no check on sub cat, user selected all, or user send the same sbcategory that he have on subs
			if (isBrandCatSubCat && (subscriptionsSubCatBase.length == 0 || (subscriptionsSubCatBase.includes(subCategoryIdsArr[0]) || subCategoryIdsArr[0] === 0))){
				query = query.andWhere(subCategoryIdsArr.length ? `subCategories.id IN (:...subCategoryIdsArr)` : '1=1', { subCategoryIdsArr })
				
			}
			if (!isBrandCatSubCat || !requestedByUser ){
				query = query.andWhere(spaceTypesIdArr.length ? `Space.spaceTypeId IN (:...spaceTypesIdArr)` : '1=1', { spaceTypesIdArr })
			}
		}

		winstonLogger.info('SpaceService._baseList final query: ' , query.getQuery());
		return query;
	}

	/**
	 * Get space list with filter
	 * @param {SpaceFilterRequest} params - Space filter params
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async list(params: SpaceFilterRequest, requestedByUser?: UserEntity | undefined): Promise<[SpaceEntity[], number]> {
		const { limit = 10, offset = 0, latitude, longitude } = params;
        const isMapsOrderedPackagesEnabled = await this.features.isEnabled(FeatureFlag.mapsOrderedPackages);

		const user = await MainDataSource.getRepository(UserEntity)
			.createQueryBuilder('user')
			.leftJoinAndSelect('user.adminVenues', 'adminVenues')
			.leftJoinAndSelect('user.role', 'role')
			.leftJoinAndSelect('user.brand', 'brand')
			.where('user.id = :userId', { userId: requestedByUser?.id })
			.getOne();

			const subs = await UserService._getSubscriptionsByUserId(requestedByUser?.id, [
				'spaceTypes',
				'brands',
				'venues',
				'space',
				'venueTypes',
				'subCategories',
			]);

			if(user && subs && subs.length)
			{
			//if user have any active subscription then replace spaceId value from user table to active subscription's spaceId value
			user.spaceId = subs[0].spaceId
			}

			//local venues: collection of veues selected on specific subscription to make visibility of packages
			//global venues: collection of veues selected on specific package to make visibility of packages
			let localVenueIds: number[] = [];
			let venueIds: number[] = [];
			let subCategoryIds: number[] = [];

			if (subs.length) {
				subs.forEach((detail) => {
					if (detail.venues?.length) {
						detail.venues.forEach((detail) => {
							localVenueIds.push(detail.id);
						})};
					if (detail.subCategories?.length) {
						detail.subCategories.forEach((detail) => {
							subCategoryIds.push(detail.id);
						})}
				});
			}

			if(user?.spaceId !== undefined && user?.spaceId>0)
			{
				const space = await MainDataSource.getRepository(SpaceEntity).findOneOrFail({ where: { id: user?.spaceId } });

				//if user have public type of package show then show all else filter space list by venue visibility
				if(space?.packageShow?.includes(PackageShow.MEMBERSHIP) || space?.packageShow?.includes(PackageShow.TEAM_MEMBERSHIP))
				{
					const packageVenue = await MainDataSource.getRepository(PackageVenuesEntity).find({
					where: { spaceId: user?.spaceId },
					select: ['venueId'],
					});

				if (packageVenue.length) {
					packageVenue.forEach((detail) => {
					venueIds.push(detail.venueId);
					});
					}
				}
			}

		let query = await this._baseList(params,false, requestedByUser);

		//Apply filter of venue visisbility if user is a member, for admin we need to fetch all the package for that venue
		if(!requestedByUser?.isAdmin)
		{
			//first apply filter on venues selected on active subscription, if no venue selected on active subscription then filter on basis of package's venue visibility
			if(localVenueIds.length>0)
			{
				query.andWhere("Space.venueId IN (:...ids)", { ids: localVenueIds })
			}
			else if(venueIds.length>0){
				query.andWhere("Space.venueId IN (:...ids)", { ids: venueIds })
			}

			//if user selected a diffrent brand sub category than the subscription one
			if(subCategoryIds.length>0 && params?.subCategoryIds && !subCategoryIds.includes(params?.subCategoryIds[0]))
			{
				return [[],0];
			}

		}
		query = query.take(limit).skip(offset);

		if (longitude && latitude && isMapsOrderedPackagesEnabled) {
            query = query.orderBy('distance', 'ASC');
		} else {
			query = query.orderBy('Space.id', 'DESC');
		}     
		winstonLogger.info('********* space list query *********', query.getQuery());

		
		return await query.getManyAndCount();
	}

	/**
	 * Get space list with filter for wordpress
	 * @param {SpaceFilterRequest} params - Space filter params
	 */
	async listWP(params: SpaceFilterRequest): Promise<SuccessResponseInterface<any>> 
	{		
		const query = await this._baseList(params,true);

		//query to get total count
		const queryTotalCount = await this._baseList(params,true);
		const pageSize = Number(params.pageSize) || 400;

		//first time we need data from first (0 skip)
		const skip = Number(params.page)-1||0;

		let res = await query
			.leftJoinAndSelect('Space.amenities', 'amenities')
			.leftJoinAndSelect('amenities.amenity', 'amenities.amenity')
			.leftJoinAndSelect('spaceType.parent', 'spaceTypeParent')
			.distinctOn(['Space.id'])
			.select(['Space.id'])
			.addSelect('Space.description')
			.addSelect('Space.subCategory')
			.addSelect('Space.name')
			.addSelect('Space.alias')
			.addSelect('Space.price')
			.addSelect('Space.quantity')
			.addSelect('Space.capacity')
			.addSelect('venue.brandId')
			.addSelect('venue.brand')
			.addSelect('amenities.amenity.name')
			.addSelect('amenities.name')
			.addSelect('amenities.description')
			.addSelect('amenities.price')
			.addSelect('amenities.salesTax')
			.addSelect('Space.hideQuantity')
			.addSelect('Space.notAllowCredit')
			.addSelect('Space.quantityUnlimited')
			.addSelect('Space.chargeType')
			.addSelect('Space.tax')
			.addSelect('spaceType.name')
			.addSelect('spaceType.alias')
			.addSelect('spaceTypeParent.name')
			.addSelect('spaceTypeParent.alias')
			.addSelect('photos.url')
			.addSelect('eventData.accessHoursFrom')
			.addSelect('eventData.accessHoursTo')
			.addSelect('eventData.date')
			.addSelect('venue.id')
			.addSelect('venue.name')
			.addSelect('venue.alias')
			.addSelect('venue.country')
			.addSelect('venue.currency')
			.addSelect('venue.state')
			.addSelect('venue.city')
			.orderBy('Space.id','DESC')
			.cache(true)
			//each time we need to skip total records of prev page
			.offset(Number(skip*pageSize))
			.limit(Number(pageSize))
			.getMany()

			//query to get count of total data
			const totalCount = await queryTotalCount
			.leftJoinAndSelect('Space.amenities', 'amenitiesData')
			.leftJoinAndSelect('amenitiesData.amenity', 'amenitiesData.amenity')
			.leftJoinAndSelect('spaceType.parent', 'spaceTypeParentData')
			.select('Space.id')
			.groupBy('Space.id')
			.getCount();

			const returnItems: SpaceEntity[] = await Promise.all(
				res.map(async (item) => {
					let [brand, space] = await Promise.all([
						MainDataSource.getRepository(BrandEntity).findOne({
							where: { id: item.venue.brandId },relations: { logo: true, brandCategories:true },
							select: ['id', 'name','logoFileId', 'logo', 'brandCategory','brandCategories','domain','chargeCustomer'],
						}),	
						MainDataSource.getRepository(SpaceEntity).findOne({
							where: { id: item.id },relations: { subCategories: true },
							select: ['id', 'name'],
						}),					
					]);
					//remove below hardcoding after 873 epic is done
					brand = brand as unknown as BrandEntity;
					item.venue.brand = brand ;
					if(space?.subCategories) item.subCategories = space.subCategories ;
					item.checkOutURL =`https://${DOMAIN}${getSpaceUrl(item)}/?source=wp`; 				
					if(brand.logo){
						brand.logo.url =  `${MEDIA_URL.replace(/'/g, '')}/434x176${brand.logo.url.replace(/\.(png|jpg|jpeg|gif)($|\?)/, '.webp')}`
					}
					return item; 
				})
			); 	
			res = returnItems;

			const data : SuccessResponseInterface<any> = { 
				data : res.map((s) => ({
							...s,
							url: `https://${DOMAIN}${getSpaceUrl(s)}`,
							 photos: s.photos.map((f) => ({
							 	...f,
							 	url:  f.url.includes('/video')? `${MEDIA_URL.replace(/'/g, '')}${f.url}`
								:`${MEDIA_URL.replace(/'/g, '')}/434x176${f.url.replace(/\.(png|jpg|jpeg|gif)($|\?)/, '.webp')}`,
							})),							
						})),
						total : totalCount,
						totalPage : Math.ceil(totalCount/pageSize)
					};
					return data;
	}

	/**
	 * Get space available times
	 * @param {number} spaceId - Space ID
	 * @param {string} userId - User ID
	 * @param {string} startDate - Start date (YYYY-MM-DD)
	 * @param {string} endDate - Start date (YYYY-MM-DD)
	 * @param {number} excludeReservationId - Reservation id to exclude from reserved items
	 * @param {string} userTZ - Deprecated: User timezone. If nothing will use space TZ
	 * @returns {Promise<AvailableDateWebInterface[]>}
	 */
	async getAvailable(
		spaceId: number,
		{ userId, startDate, endDate, excludeReservationId, userTZ }: GetSpaceAvailabilityDto
	): Promise<AvailableDateWebInterface[]> {
		if (typeof spaceId === 'undefined') {
			throw new NotFoundErrorResp({ message: 'Not found Space.' });
		}

		const spaceRepo = MainDataSource.getRepository(SpaceEntity);
		const reservationRepo = MainDataSource.getRepository(ReservationEntity);

		const space = await spaceRepo.findOneOrFail({
			where: { id: spaceId },
			relations: ['venue','venue.blockOutDates', 'venue.accessCustomData', 'spaceType'],
		});

		const subs = await UserService._getSubscriptionsByUserId(userId, []);

		const subscription247 = subs.find((s) => s.brandId === space.venue.brandId && s.access247);

		const tz = space.venue.tzId;

		if (!startDate) startDate = dayjs().tz(tz, true).format('YYYY-MM-DD');
		if (!endDate) endDate = dayjs(startDate, 'YYYY-MM-DD').tz(tz, true).add(1, 'week').format('YYYY-MM-DD');

		const startDateObj = dayjs(startDate, 'YYYY-MM-DD').startOf('d').tz(tz, true);
		const endDateObj = dayjs(endDate, 'YYYY-MM-DD').endOf('d').tz(tz, true);

		const reservations: ReservationEntity[] = await reservationRepo
			.createQueryBuilder('reservations')
			.where([
				{
					hoursFrom: Between(startDateObj.toDate(), endDateObj.toDate()),
					spaceId: space.id,
					status: ReservationStatus.ACTIVE,
				},
				{
					hoursTo: Between(startDateObj.toDate(), endDateObj.toDate()),
					spaceId: space.id,
					status: ReservationStatus.ACTIVE,
				},
			])
			.getMany();

		let dateFrom = startDateObj.clone();

		if (endDateObj.isBefore(startDateObj)) {
			throw new ValidationErrorResp({ message: "Start date and end date aren't correct" });
		}

		const res: AvailableDateWebInterface[] = [];

		while (dateFrom.isBefore(endDateObj)) {
			res.push(
				this.getSpaceAvailableHoursByDate({
					inputDate: dateFrom,
					space,
					is247: !!subscription247,
					tzId: tz,
					reservations,
					excludeReservationId,
				})
			);
			dateFrom = dateFrom.add(1, 'd');
		}
		return res;
	}

	/**
	 * Get space availability with hours by date.
	 * @param {Dayjs} inputDate Date to get available times
	 * @param {SpaceEntity} space [Space to get available times]{@link SpaceEntity}
	 * @param {boolean} is247 (Optional. Default - false )If user has 24/7 subscription for same brand as space
	 * @param {string} tzId (Optional. Default - Venue.tzId ) User time zone ID
	 * @param {number} excludeReservationId Reservation id to exclude from reserved items
	 * @param {ReservationEntity[]} reservations [Space reservations array]{@link ReservationEntity}
	 */
	getSpaceAvailableHoursByDate({
		inputDate,
		space,
		is247 = false,
		tzId,
		reservations,
		excludeReservationId,
	}: {
		inputDate: Dayjs;
		space: SpaceEntity;
		is247?: boolean;
		tzId?: string;
		reservations: ReservationEntity[];
		excludeReservationId?: string | undefined;
	}): AvailableDateWebInterface {
		const day = inputDate.format('dddd');
		const date = inputDate.format('YYYY-MM-DD');

		let thisReservations = reservations.filter((r) => inputDate.isSame(dayjs(r.hoursFrom), 'day'));
		if (excludeReservationId) thisReservations = thisReservations.filter((r) => r.id !== Number(excludeReservationId));

		const todayReserved = false;
		const allBlockOutDates = space.venue.blockOutDates.map(x => String(x.blockOutDate));
		const nowObj = dayjs().tz(tzId || space.venue.tzId);
		const sameDay = inputDate.isSame(nowObj, 'day');

		if (sameDay) {
			inputDate = nowObj;
			if (nowObj.minute() >= 15 && nowObj.minute() <= 45) inputDate = inputDate.startOf('hour').add(30, 'minutes');
			if (nowObj.minute() > 45) inputDate = inputDate.endOf('hour').add(1, 'second');
			if (nowObj.minute() < 15) inputDate = inputDate.startOf('hour');
		}

		if (is247) {
			const from = inputDate;
			const to = inputDate.tz(tzId || space.venue.tzId).endOf('day');

			return {
				date,
				open: !allBlockOutDates.includes(date), 
				reserved: todayReserved,
				items: ![SpaceTypeLogicType.WEEKLY].includes(space.spaceType.logicType)&& !allBlockOutDates.includes(date)
					? this.getOpenTimes({ from, to, reservations: thisReservations, space })
					: [],
				from: from.format('HH:mm:ss'),
				to: to.format('HH:mm:ss'),
			};
		}

		if (space.venue.accessCustom) {
			const accessData = space.venue.accessCustomData;
			const todayAccess = accessData.find((acd: AccessCustomDataEntity) => acd.weekday === day);

			if (todayAccess) {
				const getHours = (type: 'from' | 'to') =>
					todayAccess.open
						? dayjs
								.tz(
									type === 'from' ? (sameDay ? inputDate : todayAccess.accessHoursFrom) : todayAccess.accessHoursTo,
									'HH:mm:ss',
									space.venue.tzId
								)
								.date(inputDate.date())
								.month(inputDate.month())
								.year(inputDate.year())
								.tz(tzId || space.venue.tzId)
						: dayjs
								.tz('00:00:00', 'HH:mm:ss', tzId || space.venue.tzId)
								.date(inputDate.date())
								.month(inputDate.month())
								.year(inputDate.year());

				const from = getHours('from');
				let to = getHours('to');

				if (to.isBefore(from)) to = to.add(1, 'd');

				return {
					date,
					open: allBlockOutDates.includes(date) ? false: todayAccess.open,
					reserved: todayReserved,
					items: ![SpaceTypeLogicType.WEEKLY].includes(space.spaceType.logicType) && !allBlockOutDates.includes(date)
						? this.getOpenTimes({ from, to, reservations: thisReservations, space })
						: [],
					from: from.format('HH:mm:ss'),
					to: to.format('HH:mm:ss'),
				};
			}
		}

		const from = dayjs
			.tz(sameDay ? inputDate : space.venue.accessHoursFrom, 'HH:mm:ss', space.venue.tzId)
			.date(inputDate.date())
			.month(inputDate.month())
			.year(inputDate.year())
			.tz(tzId || space.venue.tzId);
		let to = dayjs
			.tz(space.venue.accessHoursTo, 'HH:mm:ss', space.venue.tzId)
			.date(inputDate.date())
			.month(inputDate.month())
			.year(inputDate.year())
			.tz(tzId || space.venue.tzId);

		if (to.isBefore(from)) to = to.add(1, 'd');
		return {
			date,
			open: !allBlockOutDates.includes(date),
			reserved: todayReserved,
			from: from.format('HH:mm:ss'),
			to: to.format('HH:mm:ss'),
			items: ![SpaceTypeLogicType.WEEKLY].includes(space.spaceType.logicType) && !allBlockOutDates.includes(date)
				? this.getOpenTimes({ from, to, reservations: thisReservations, space })
				: [],
		};
	}

	/**
	 * Get space open times
	 * Reserved will be FALSE for drop in (minutely logic type)
	 * @param {Dayjs} from Time from
	 * @param {Dayjs} to Time to
	 * @param {ReservationEntity[]} reservations [array of space reservations]{@link ReservationEntity}
	 * @param {SpaceEntity} space [space entity]{@link SpaceEntity}
	 * @returns {AvailableDateItemInterface[]} [Available date items (times)]{@link AvailableDateItemInterface}
	 */
	getOpenTimes({
		from,
		to,
		reservations,
		space,
	}: {
		from: Dayjs;
		to: Dayjs;
		reservations: ReservationEntity[];
		space: SpaceEntity;
	}): AvailableDateItemInterface[] {
		if (from.isSame(to)) return [];
		let times = [];

		let timeFrom = from.clone();

		const timeTo = to.clone();

		const maxTime = space.roundHours ? dayjs(timeTo, 'HH:mm:ss').subtract(space.roundHours, 'hour').add(1, 'second') : dayjs(timeTo, 'HH:mm:ss');

		while (timeFrom.isSameOrBefore(timeTo)) {
			times.push({
				value: timeFrom.format(),
				isMinTime: false,
				reserved: false,
			});
			timeFrom = timeFrom.add(30, 'minute');
		}

		times = times.map((t) => {
			const isMinTime = dayjs(t.value).isSameOrAfter(maxTime);
			const reserved =
				reservations.filter(
					(r: ReservationEntity) =>
						dayjs(t.value).isSame(dayjs(r.hoursFrom)) ||
						dayjs(t.value).isSame(dayjs(r.hoursTo)) ||
						dayjs(t.value).isBetween(dayjs(r.hoursFrom), dayjs(r.hoursTo))
				).length > 0;

			return {
				...t,
				reserved: space.spaceType.logicType === SpaceTypeLogicType.MINUTELY ? false : reserved,
				isMinTime,
			};
		});

		return times;
	}

	/**
	 * Delete space by id with space subscriptions.
	 * @param {number} id Space ID
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<SpaceEntity>}
	 */
	async delete(id: number, requestedByUser?: UserEntity | undefined): Promise<SpaceEntity> {
		const reservationRepo = MainDataSource.getRepository(ReservationEntity);
		const subscriptionRepo = MainDataSource.getRepository(SubscriptionEntity);
		const space = await MainDataSource.getRepository(SpaceEntity).findOneOrFail({ where: { id }, relations: { venue: true } });

		if (!space._canDelete!(requestedByUser)) throw new ForbiddenResponse();

		const reservationsCount = await reservationRepo
			.createQueryBuilder('Reservation')
			.andWhere('Reservation.spaceId = :id', { id })
			.andWhere('Reservation.status = :status', { status: ReservationStatus.ACTIVE })
			.getCount();

		if (reservationsCount > 0) {
			throw new ForbiddenResponse({ message: "Can't delete: Space has active reservations!" });
		}

		const upcomingInvoiceStatuses = await MainDataSource.getRepository(InvoiceStatusEntity).find({
			where: [{ name: 'Upcoming' }, { name: 'Upcoming-Hours' }],
			select: ['id'],
		});

		const spaceInvoices = await MainDataSource.getRepository(InvoiceEntity).find({
			where: { spaceId: Number(id), invoiceStatus: In(upcomingInvoiceStatuses.map((i) => i.id)) },
		});

		if (spaceInvoices.length > 0) throw new ForbiddenResponse({ message: 'Cannot be deleted, has invoices attached!' });

		const spaceSubscriptions = await subscriptionRepo
			.createQueryBuilder('Subscription')
			.andWhere('Subscription.spaceId = :id', { id })
			.andWhere('Subscription.status = :status', { status: EntityStatus.ACTIVE })
			.andWhere('Subscription.isOngoing = :isOngoing', { isOngoing: true })
			.getMany();

		if (spaceSubscriptions.length > 0) {
			await Promise.all(
				spaceSubscriptions.map(async (subscription) => {
					await this.subscriptionService.delete(subscription.id);
				})
			);
		}

		space.status = SpaceStatus.DELETED;
		await MainDataSource.getRepository(SpaceEntity).save(space);

		return space;
	}

	/**
	 * List pins on map
	 * @param {SpaceFilterRequest} params - space filter {@link SpaceFilterRequest}
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async listPins(params: SpaceFilterRequest, requestedByUser?: UserEntity | undefined): Promise<SpacePinsOutputInterface[]> {
		const query = await this._baseList(params,false, requestedByUser,true);

		const res = await query
			.andWhere('venue.showOnMap=true')
			.limit(99999)
			.select(['Space.id', 'venue.name', 'venue.id', 'venue.alias', 'venue.address', 'venue.address2', 'venue.coordinates', 'venuePhotos', 'venueLogo'])
			.getMany();

		const user = await MainDataSource.getRepository(UserEntity)
			.createQueryBuilder('user')
			.leftJoinAndSelect('user.adminVenues', 'adminVenues')
			.leftJoinAndSelect('user.role', 'role')
			.leftJoinAndSelect('user.brand', 'brand')
			.where('user.id = :userId', { userId: requestedByUser?.id })
			.getOne();
			const pins: SpacePinsOutputInterface[] = [];

			const subs = await UserService._getSubscriptionsByUserId(requestedByUser?.id, [
				'spaceTypes',
				'brands',
				'venues',
				'space',
				'venueTypes',
				'space.packageSubCategories',
				'subCategories',
			]);

			if(user && subs && subs.length)
			{
			user.spaceId = subs[0].spaceId
			}
			
		if (user?.spaceId !== undefined && user?.spaceId === 0) {
			this.locatePins(res, pins);
			return pins;
		}
			
		const space = await MainDataSource.getRepository(SpaceEntity).findOneOrFail({ where: { id: user?.spaceId} });

		if (
			user &&
			space &&
			(space?.packageShow?.includes(PackageShow.MEMBERSHIP) || space?.packageShow?.includes(PackageShow.TEAM_MEMBERSHIP)) &&
			user.spaceId
		) {
			const packageVenue = await MainDataSource.getRepository(PackageVenuesEntity).find({
				where: { spaceId: user.spaceId },
				select: ['venueId'],
			});
			let localVenueIds: number[] = [];

			let subCategoryIds: number[] = [];

			if (subs.length) {
				subs.forEach((detail) => {
					if (detail.venues?.length) {
						detail.venues.forEach((detail) => {
							localVenueIds.push(detail.id);
						})};

						if (detail.subCategories?.length) {
							detail.subCategories.forEach((detail) => {
								subCategoryIds.push(detail.id);
							})}
				});
			}

			//if user selected a diffrent brand sub category than the subscription one
			if(subCategoryIds.length>0 && params?.subCategoryIds && !subCategoryIds.includes(params?.subCategoryIds[0]))
				{
					return [];
				}
			//filter on basis of active subscription's venue visibility
			if (localVenueIds.length)
			{
				const filtereddata = res.filter(function (item) {
					return localVenueIds.includes(item.venue.id);
				});

				this.locatePins(filtereddata, pins);
			}
			//filter on basis of space's venue visibility
			else if (packageVenue.length) {
				let venueIds: number[] = [];
				packageVenue.forEach((detail) => {
					venueIds.push(detail.venueId);
				});

				const filtereddata = res.filter(function (item) {
					return venueIds.includes(item.venue.id);
				});

				this.locatePins(filtereddata, pins);
			} else {
				this.locatePins(res, pins);
			}
		} else {
			this.locatePins(res, pins);
		}
		return pins;
	}

	async locatePins(res: SpaceEntity[], pins: SpacePinsOutputInterface[]) {
		res.forEach((r) => {
			const exist = pins.findIndex((p) => p.id === r.venue.id);
			if (exist === -1) {
				pins.push({
					id: r.venue.id,
					name: r.venue.name,
					alias: r.venue.alias,
					address: r.venue.address,
					address2: r.venue.address2,
					coordinates: r.venue.coordinates,
                    logo: r.venue.logo,
					photos: r.venue.photos,
					spaceCount: 1,
				});
			} else {
				pins[exist].spaceCount += 1;
			}
		});
	}

	async saveSpaceToStripe({ spaceId, oldPrice, oldSecurityPrice }: { spaceId: number; oldPrice?: number | undefined; oldSecurityPrice: number }, requestedByUser: UserEntity): Promise<any> {
		const space = await MainDataSource.getRepository(SpaceEntity).findOneOrFail({
			where: { id: spaceId },
			relations: ['photos', 'venue', 'spaceType', 'providerData'],
		});

		if (!space._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		if (space.providerData && space.providerData.length) {
			if ((space.price && space.price !== oldPrice) || (space.securityDepositPrice && space.securityDepositPrice !== oldSecurityPrice)) {
				await this.stripeService.createSpacePrice({
					userId: requestedByUser.id,
					createdById: requestedByUser.id,
					spaceId: space.id,
					currency: space.venue.currency,
					price: space.price,
					securityDepositPrice: space.securityDepositPrice,
					stripeProductId: space.providerData[0].providerItemId,
				});
			}

			await Promise.all(
				space.providerData.map(async (providerData) => {
					if (providerData.provider === PaymentProvider.STRIPE) {
						await this.stripeService.updateSpaceProduct({
							spaceId: space.id,
							userId: requestedByUser.id,
							updatedById: requestedByUser.id,
							providerId: providerData.providerItemId,
						});
					}
				})
			);
		} else {
			await this.stripeService.createSpaceProduct({
				userId: requestedByUser.id,
				createdById: requestedByUser.id,
				spaceId: space.id,
			});
		}
	}
}
