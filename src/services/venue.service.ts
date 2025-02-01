import { Brackets, IsNull, Not, SelectQueryBuilder } from 'typeorm';
import { createActor } from 'xstate';
import VenueEntity from '@entity/venue.entity';
import SpaceEntity from '@entity/space.entity';
import { prepareImage, uploadToS3, uploadVideoToS3 } from '@helpers/s3';
import loggerHelper from '@helpers/logger.helper';
import getRandomInt from '@helpers/get-random-int.helper';
import AccessCustomDataEntity from '@entity/access-custom-data.entity';
import ValidateEmailHelper from '@helpers/validate-email.helper';
import VenueFilter from '@src/interface/venue-filter.interface';
import SpaceStatus from 'dd-common-blocks/dist/type/SpaceStatus';
import { getMimeFromUrl } from 'dd-common-blocks';
import VenueStatus from '@utils/constants/venue-status';
import BrandRoleType from 'dd-common-blocks/dist/type/BrandRoleType';
import BaseService from '@services/base.service';
import { ForbiddenResponse } from '@utils/response/forbidden.response';
import { EntityNotFoundError } from 'typeorm/error/EntityNotFoundError';
import imageToBase64 from '@utils/helpers/image-to-base64.helper';
import StripeService from '@services/stripe.service';
import delay from '@utils/helpers/delay.helper';
import { Inject, Service } from 'typedi';
import { MEDIA_URL } from '../config';
import UserEntity from '../entity/user.entity';
import MainDataSource from '../main-data-source';
import ChargeType from 'dd-common-blocks/dist/type/ChargeType';
import VenueBlockOutDatesEntity from '@src/entity/venue-blockout-dates.entity';
import BrandEntity from '@src/entity/brand.entity';
import dayjs from 'dayjs';
import VenueStateMachine from '@src/utils/state-machines/venue-state-machine';
import { FeatureFlag } from '@src/utils/feature-flag';

/**
 * Handle all actions with Venue.
 * @module AmenityService
 * @category Services
 */
@Service()
export default class VenueService extends BaseService {
	@Inject()
	stripeService: StripeService;

	constructor() {
		super();
		this.entity = VenueEntity;
	}

	/**
	 * Validate email
	 * @param value
	 * @param venueId
	 */
	async _emailValidator(value: string, venueId: string | undefined): Promise<boolean | Error> {
		const isValid = await ValidateEmailHelper(value);

		if (!isValid) throw new Error(`Value ${value} is not valid email address`);

		const item = await MainDataSource.getRepository(VenueEntity).createQueryBuilder('Venue').andWhere(`email = :value`, { value }).getOne();

		if (!item || String(item.id) === String(venueId)) return true;

		throw new Error(`Email ${value} is already taken`);
	}

	/**
	 * Venue name validator
	 * @param value
	 * @param venueId
	 */
	async _nameValidator(value: string, venueId: string | undefined): Promise<boolean | Error> {
		const item = await MainDataSource.getRepository(VenueEntity).findOne({ where: { name: value }, select: ['id', 'name'] });
		if (!item || String(item.id) === String(venueId)) return true;
		throw new Error(`Item with name ${value} already exist`);
	}

	/**
	 * Get single venue
	 * @param id
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async single(id: number, requestedByUser?: UserEntity | undefined): Promise<VenueEntity | ForbiddenResponse | EntityNotFoundError> {
		const item: VenueEntity = await MainDataSource.getRepository(VenueEntity).findOneOrFail({
			where: { id },
			relations: ['photos', 'logo', 'brand', 'brand.brandCategories', 'brand.brandCategories.subCategories', 'accessCustomData'],
		});
		if (item.status !== VenueStatus.PUBLISH && !(requestedByUser?.isSuperAdmin() || requestedByUser?.isAdmin)) throw new ForbiddenResponse();
		return item;
	}

	/**
	 * Check if venue already exist
	 * @param params
	 */
	checkExist(params: { name?: string; alias?: string }): Promise<number> {
		// @ts-ignore
		return MainDataSource.getRepository(VenueEntity).count(params);
	}

	/**
	 * Update single venue
	 * @param id
	 * @param data
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async update(id: number, data: Partial<VenueEntity>, requestedByUser?: UserEntity | undefined): Promise<VenueEntity> {
		const cloneData = data;

		const customAccessRepo = MainDataSource.getRepository(AccessCustomDataEntity);
		const venue = await MainDataSource.getRepository(VenueEntity).findOneOrFail({ where: { id }, relations: ['photos'] });

		const attachments: string[] = cloneData.uploadAttachments || [];

		if (!cloneData.imageUrls && attachments.length === 0 && data.photos?.length === 0) {
			throw new ForbiddenResponse({ message: 'Venue must have at least one photo!' });
		}

		if (cloneData.imageUrls) {
			await Promise.all(
				cloneData.imageUrls.map(async (url) => attachments.push(`data:${getMimeFromUrl(url)};base64,${await imageToBase64(url)}`))
			);
		}

		if (cloneData.accessCustomData) {
			await Promise.all(
				cloneData.accessCustomData.map(async (acd) => {
					const clone = acd;
					clone.venueId = venue.id;

					if (clone.id) {
						await customAccessRepo.update(clone.id, clone);
					} else {
						const newACD = customAccessRepo.create(clone);
						await customAccessRepo.save(newACD);
					}
				})
			);
			delete cloneData.accessCustomData;
		}

		if (cloneData.uploadLogo) {
			try {
				const image64 = await prepareImage(cloneData.uploadLogo, 128);
				const file = await uploadToS3(image64, 'venue', String(id), String(new Date().valueOf()));
				cloneData.logoFileId = file.id;
				delete cloneData.uploadLogo;
			} catch (e) {
				loggerHelper.error('logo saving failed - ', e);
			}
		}
		if (attachments.length) {
			await Promise.all(
				attachments.map(async (attachment) => {
					try {
						if (!attachment.includes('video')) {
							const image64 = await prepareImage(attachment, 1024);
							const file = await uploadToS3(image64, 'venue', String(id), String(new Date().valueOf()));
							cloneData.photos?.push(file);
						}
					} catch (e) {
						loggerHelper.error('image saving failed - ', e);
					}
				})
			);
			const videoList = attachments.filter(a => a.includes('video'));
			if (videoList.length > 0) {
				try {
					for (const attachment of videoList) {
						const file = await uploadVideoToS3(attachment, 'venue', String(id), String(new Date().valueOf()));
						cloneData.photos?.push(file);
					}
				}
				catch (e) {
					loggerHelper.error('video saving failed - ', e);
				}
			}
			delete cloneData.uploadAttachments;
		}

		const updatedVenue = await MainDataSource.getRepository(VenueEntity).save({ ...venue, ...cloneData });
		const venueOnboardingFeatureFlag = await this.features.isEnabled(FeatureFlag.venueOnboarding);
		if (venueOnboardingFeatureFlag) {
			const venueActor = createActor(VenueStateMachine);
			venueActor.start();
			venueActor.send({ type: 'STATUS_CHANGED', newStatus: updatedVenue.status, currentStatus: venue.status, venueId: updatedVenue.id });
			venueActor.stop();
		}

		if (cloneData.currency && cloneData.currency !== venue.currency) {
			loggerHelper.info('currency changed. updating spaces provider prices...');
			const spaces = await MainDataSource.getRepository(SpaceEntity).find({
				where: { venueId: venue.id },
				relations: ['providerData'],
				select: ['id', 'providerData', 'createdById', 'chargeType', 'price'],
			});

			const mapSpaces = async (spacesArr: SpaceEntity[]) => {
				for (let i = 0; i < spacesArr.length; i++) {
					let space = spacesArr[i];
					if (space.providerData && space.providerData.length)
						await this.stripeService.createSpacePrice({
							userId: requestedByUser ? requestedByUser.id : space.createdById,
							createdById: requestedByUser ? requestedByUser.id : space.createdById,
							spaceId: space.id,
							currency: String(cloneData.currency),
							price: space.chargeType === ChargeType.FREE ? 0 : space.price,
							securityDepositPrice: space.securityDepositPrice,
							stripeProductId: space.providerData[0].providerItemId,
						});
					else
						await this.stripeService.createSpaceProduct({
							spaceId: space.id,
							userId: requestedByUser ? requestedByUser.id : space.createdById,
							createdById: requestedByUser ? requestedByUser.id : space.createdById,
						});
				}
			};

			await mapSpaces(spaces);
		}
		return updatedVenue;
	}

	/**
	 * Create single venue
	 * @param data
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async create(data: Partial<VenueEntity>, requestedByUser?: UserEntity | undefined): Promise<VenueEntity> {
		if (requestedByUser?.isSuperAdmin() || requestedByUser?.isAdmin) {
			const cloneData = data;

			const customAccessRepo = MainDataSource.getRepository(AccessCustomDataEntity);

			const { uploadLogo } = cloneData;
			const attachments: string[] = cloneData.uploadAttachments || [];

			if (!cloneData.imageUrls && attachments.length === 0) {
				throw new ForbiddenResponse({ message: 'Venue must have at least one photo!' });
			}

			if (cloneData.imageUrls) {
				await Promise.all(
					cloneData.imageUrls.map(async (url) => attachments.push(`data:${getMimeFromUrl(url)};base64,${await imageToBase64(url)}`))
				);
			}

			const { accessCustomData } = cloneData;
			delete cloneData.uploadAttachments;
			delete cloneData.accessCustomData;
			delete cloneData.uploadLogo;

			if (cloneData.alias) {
				const aliasExist = await MainDataSource.getRepository(VenueEntity).count({ where: { alias: cloneData.alias } });
				if (aliasExist > 0) cloneData.alias += getRandomInt(0, 200);
			}

			const newVenueObj = MainDataSource.getRepository(VenueEntity).create(cloneData);
			const newVenue = await MainDataSource.getRepository(VenueEntity).save(newVenueObj);

			// check if user has role "venue admin" and assign venue to him
			if (cloneData.createdById) {
				try {
					const user = await MainDataSource.getRepository(UserEntity).findOneOrFail({
						where: { id: +cloneData.createdById },
						relations: ['adminVenues', 'role'],
					});
					if (user.role?.roleType === BrandRoleType.VENUE_ADMIN) {
						user.adminVenues = user.adminVenues ? [...user.adminVenues, newVenue] : [newVenue];
						await MainDataSource.getRepository(UserEntity).save(user);
					}
				} catch (e) {
					loggerHelper.error(`Venue creating error: no user with id ${cloneData.createdById}`);
				}
			}

			if (attachments && attachments.length) {
				newVenue.photos = [];
				await Promise.all(
					attachments.map(async (attachment) => {
						try {
							if (!attachment.includes('video')) {
								const image64 = await prepareImage(attachment, 1024);
								const file = await uploadToS3(image64, 'venue', String(newVenue.id), String(new Date().valueOf()));
								newVenue.photos.push(file);
							}
						} catch (e) {
							loggerHelper.error('image saving failed - ', e);
						}
					})
				);
				const videoList = attachments.filter(a => a.includes('video'));
				if (videoList.length > 0) {
					try {
						for (const attachment of videoList) {
							const videofile = await uploadVideoToS3(attachment, 'venue', String(newVenue.id), String(new Date().valueOf()));
							newVenue.photos.push(videofile);
						}
					}
					catch (e) {
						loggerHelper.error('video saving failed - ', e);
					}
				}
			}

			if (accessCustomData) {
				await Promise.all(
					accessCustomData.map(async (acd) => {
						const newACD = customAccessRepo.create({ ...acd, venueId: newVenue.id });
						await customAccessRepo.save(newACD);
					})
				);
			}

			if (uploadLogo) {
				try {
					const image64 = await prepareImage(uploadLogo, 128);
					const file = await uploadToS3(image64, 'venue', String(newVenue.id), String(new Date().valueOf()));
					newVenue.logoFileId = file.id;
				} catch (e) {
					loggerHelper.error('logo saving failed - ', e);
				}
			}

			await MainDataSource.getRepository(VenueEntity).save(newVenue);

			return newVenue;
		}
		throw new ForbiddenResponse();
	}

	/**
	 * Base venues list with filter
	 * @param {VenueFilter} params
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async _baseList(params: VenueFilter, requestedByUser?: UserEntity | undefined): Promise<SelectQueryBuilder<VenueEntity>> {
		const {
			brandId,
			brandIds,
			venueTypeIds,
			searchString,
			address,
			country,
			city,
			state,
			longitude,
			latitude,
			radius = 100000,
			withCreatedBy,
			withUpdatedBy,
		} = params;
		let user: UserEntity | undefined;
		const venueStatus = [VenueStatus.PUBLISH, VenueStatus.UNPUBLISED, VenueStatus.DELETED];
		const venueOnboardingFeatureFlag = await this.features.isEnabled(FeatureFlag.venueOnboarding);

		const getLocationCoordsQuery = (): [string, any] => {
			return [
				'ST_Distance(Venue.coordinates, ST_SetSRID(ST_GeomFromGeoJSON(:origin), ST_SRID(Venue.coordinates))) <= :radius',
				{ origin: `{"type":"Point","coordinates":["${longitude}","${latitude}"]}`, radius },
			];
		};

		if (requestedByUser) {
			user = await MainDataSource.getRepository(UserEntity).findOneOrFail({ where: { id: +requestedByUser.id }, relations: ['adminVenues'] });
			if (user.isAdmin && venueOnboardingFeatureFlag && user.role?.roleType !== BrandRoleType.VENUE_ADMIN) {
				venueStatus.push(VenueStatus.REQUESTED);
				venueStatus.push(VenueStatus.REJECTED);
			}
		}

		let q = MainDataSource.getRepository(VenueEntity)
			.createQueryBuilder('Venue')
			.addSelect('Venue.brandId')
			.leftJoinAndSelect('Venue.brand', 'brand')
			.leftJoinAndSelect('Venue.accessCustomData', 'accessCustomData')
		if (params.isExport || params.packageCreatedAtRange) {
			q.leftJoinAndSelect('Venue.space', 'space')
			q.leftJoinAndSelect('space.createdBy', 'packageCreatedBy');
			q.leftJoinAndSelect('Venue.venueType', 'venueType')
			q.leftJoinAndSelect('space.spaceType', 'spaceType')
				.addSelect('venueType.name')
				.addSelect('space.name')
				.addSelect('space.status')
				.addSelect('space.createdAt')
				.addSelect('space.createdById')
				.addSelect('space.price')
				.addSelect('spaceType.name')
				.addSelect('space.chargeType')
				.addSelect('space.packageShow')
		}
		else {
			q.leftJoinAndSelect('Venue.logo', 'logo')
			q.leftJoinAndSelect('Venue.photos', 'photos')
			q.leftJoinAndSelect('Venue.blockOutDates', 'blockOutDates')
		}
		q.where(venueTypeIds && venueTypeIds.length ? `Venue.venueTypeId IN (:...venueTypeIds)` : '1=1', { venueTypeIds })
			.andWhere(brandIds && brandIds.length ? `Venue.brandId IN (:...brandIds)` : '1=1', { brandIds })
			.andWhere(brandId ? `Venue.brandId = :brandId` : '1=1', { brandId })
			.andWhere(`Venue.status IN (:...venueStatus)`, { venueStatus })
			.andWhere(address ? `LOWER(Venue.address) LIKE LOWER(:address)` : '1=1', { address: `%${address}%` })
			.andWhere(country ? `LOWER(Venue.country) LIKE LOWER(:country)` : '1=1', { country: `%${country}%` })
			.andWhere(city ? `LOWER(Venue.city) LIKE LOWER(:city)` : '1=1', { city: `%${city}%` })
			.andWhere(state ? `LOWER(Venue.state) LIKE LOWER(:state)` : '1=1', { state: `%${state}%` })
			.andWhere(searchString ? `LOWER(Venue.name) LIKE LOWER(:searchString)` : '1=1', { searchString: `%${searchString}%` });

		if (user && user.adminVenues && user.adminVenues.length)
			q = q.andWhere('Venue.id IN (:...adminVenues)', {
				adminVenues: user.adminVenues.map((v) => v.id),
			});

		if (withCreatedBy) q = q.leftJoinAndSelect('Venue.createdBy', 'createdBy');
		if (withUpdatedBy) q = q.leftJoinAndSelect('Venue.updatedBy', 'updatedBy');

		if (longitude && latitude) {
			q = q.andWhere(getLocationCoordsQuery()[0], getLocationCoordsQuery()[1]);
		}

		return q;
	}

	/**
	 * Get venues list with filter
	 * @param {VenueFilter} params
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async list(params: VenueFilter, requestedByUser?: UserEntity | undefined): Promise<[VenueEntity[], number]> {
		const { status, alias, venueIds, limit = 30, offset = 0 } = params;
		let query = await this._baseList(params, requestedByUser);
		query = query
			.addSelect('Venue.createdAt')
			.addSelect('Venue.updatedAt')
			.addSelect(
				`CASE WHEN Venue.status = :priorityStatus THEN 1 ELSE 2 END`,
				'status_priority'
			)
			.andWhere(venueIds ? `Venue.id IN (:...venueIds)` : '1=1', { venueIds })
			.andWhere(status ? `Venue.status = :status` : '1=1', { status })
			.andWhere(alias ? `Venue.alias = :alias` : '1=1', { alias })
			.addOrderBy('status_priority', 'ASC')
			.addOrderBy('Venue.updatedAt', 'DESC')
			.setParameters({ priorityStatus: 'Requested' });

		if (params.createdAtRange) {
			query = query
				.andWhere('Venue.createdAt >= :start', { start: dayjs(params.createdAtRange[0]).startOf('day').format() })
				.andWhere('Venue.createdAt < :end', { end: dayjs(params.createdAtRange[1]).endOf('day').format() });
		}

		if (params.packageCreatedAtRange) {
			query = query
				.andWhere('space.createdAt >= :start', { start: dayjs(params.packageCreatedAtRange[0]).startOf('day').format() })
				.andWhere('space.createdAt < :end', { end: dayjs(params.packageCreatedAtRange[1]).endOf('day').format() });
		}

		query = query.take(limit).skip(offset);

		return query.getManyAndCount();
	}

	/**
	 * Get venues list with filter for wordpress widget
	 * @param params
	 */
	async listWp(params: VenueFilter): Promise<[VenueEntity[], number]> {
		const query = await this._baseList(params, undefined);
		let res = await query
			// .leftJoinAndSelect('Venue.accessCustomData', 'accessCustomData')			
			.leftJoinAndSelect('Venue.venueType', 'venueType')
			.select('Venue.id')
			.addSelect('Venue.name')
			.addSelect('Venue.brandId')
			.addSelect('Venue.brand')
			.addSelect('photos.url')
			.addSelect('logo.url')
			.addSelect('venueType.name')
			.addSelect('accessCustomData.open')
			.addSelect('accessCustomData.weekday')
			.addSelect('accessCustomData.accessHoursTo')
			.addSelect('accessCustomData.accessHoursFrom')
			.addSelect('Venue.address')
			.addSelect('Venue.address2')
			.addSelect('Venue.coordinates')
			.addSelect('Venue.country')
			.addSelect('Venue.state')
			.addSelect('Venue.city')
			.addSelect('Venue.description')
			.addSelect('Venue.accessCustom')
			.addSelect('Venue.accessHoursTo')
			.addSelect('Venue.accessHoursFrom')
			.addSelect('Venue.currency')
			.cache(true)
			.getManyAndCount();

		const returnItems: VenueEntity[] = await Promise.all(
			res[0].map(async (item) => {
				let [brand] = await Promise.all([
					MainDataSource.getRepository(BrandEntity).findOne({
						where: { id: item.brandId },
						relations: { logo: true, brandCategories: true },
						select: ['id', 'name', 'logoFileId', 'logo', 'brandCategory', 'brandCategories', 'domain', 'chargeCustomer'],

					}),
				]);
				brand = brand as unknown as BrandEntity;
				item.brand = brand;
				return item;
			})
		);
		res[0] = returnItems;
		return [
			res[0].map((s) => {
				const ret = {
					...s,
					photos: s.photos.map((f) => ({
						...f,
						url: f.url.includes('/video')? `${MEDIA_URL.replace(/'/g, '')}${f.url}`
						:`${MEDIA_URL.replace(/'/g, '')}/434x176${f.url.replace(/\.(png|jpg|jpeg|gif)($|\?)/, '.webp')}`,
					})),
				};
				if (ret.logo) {
					ret.logo.url = `${MEDIA_URL.replace(/'/g, '')}/434x176${ret.logo.url.replace(/\.(png|jpg|jpeg|gif)($|\?)/, '.webp')}`;
				}
				if (ret.brand.logo) {
					ret.brand.logo.url = `${MEDIA_URL.replace(/'/g, '')}/434x176${ret.brand.logo.url.replace(/\.(png|jpg|jpeg|gif)($|\?)/, '.webp')}`;
				}
				return ret;
			}),
			res[1],
		];
	}

	/**
	 * Delete venue
	 * @param id
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async delete(id: number, requestedByUser?: UserEntity | undefined): Promise<VenueEntity> {
		const venue = await MainDataSource.getRepository(VenueEntity).findOneOrFail({ where: { id } });
		if (!venue._canDelete!(requestedByUser)) throw new ForbiddenResponse();

		const venueSpaces = await MainDataSource.getRepository(SpaceEntity).count({ where: { status: Not(SpaceStatus.DELETED), venueId: +id } });
		if (venueSpaces > 0) {
			throw new Error("Can't delete: Venue has spaces!");
		}

		return MainDataSource.getRepository(VenueEntity).save({ ...venue, status: VenueStatus.DELETED });
	}

	/**
	 * Get venues cities list with filter
	 */
	async listCities(): Promise<Partial<VenueEntity>[]> {
		const query = MainDataSource.getRepository(VenueEntity)
			.createQueryBuilder('venue')
			.distinctOn(['venue.city'])
			.orderBy('venue.city')
			.select(['venue.country', 'venue.city', 'venue.coordinates', 'venue.countryCode', 'venue.state']);

		return await query.getMany();
	}

	/**
	 * List venues locations
	 */
	async listLocations(params: VenueFilter): Promise<string[]> {
		const { searchString, venueTypeIds } = params;

		const query = MainDataSource.getRepository(VenueEntity)
			.createQueryBuilder('venue')
			.where(venueTypeIds ? `venue.venueTypeId IN (:...venueTypeIds)` : '1=1', { venueTypeIds })
			.andWhere(
				new Brackets((subQb) => {
					subQb
						.orWhere('LOWER(venue.country) LIKE LOWER(:searchString)', { searchString: `%${searchString}%` })
						.orWhere('LOWER(venue.city) LIKE LOWER(:searchString)', { searchString: `%${searchString}%` })
						.orWhere('LOWER(venue.state) LIKE LOWER(:searchString)', { searchString: `%${searchString}%` });
				})
			)
			.orderBy('venue.country')
			.addOrderBy('venue.state')
			.addOrderBy('venue.city')
			.select(['venue.country', 'venue.city', 'venue.state']);

		const items = await query.getMany();
		return [...new Set(items.map((i) => `${i.country}, ${i.state}${i.city ? ', ' : ''}${i.city}`))];
	}

	async updateProviderData({ venueId }: { venueId: number }, requestedByUser: UserEntity): Promise<any> {
		const spaces = await MainDataSource.getRepository(SpaceEntity).find({
			where: { venueId, status: SpaceStatus.PUBLISH, providerData: IsNull() },
			select: ['id'],
		});

		await Promise.all(
			spaces.map(async (space) => {
				await this.stripeService.createSpaceProduct({ userId: requestedByUser.id, createdById: requestedByUser.id, spaceId: space.id });
				await delay(1000);
			})
		);
	}

	async batchUpdateProviderData(requestedByUser: UserEntity): Promise<any> {
		const spaces = await MainDataSource.getRepository(SpaceEntity).find({
			where: { status: SpaceStatus.PUBLISH, providerData: IsNull() },
			select: ['id'],
		});

		await Promise.all(
			spaces.map(async (space) => {
				await this.stripeService.createSpaceProduct({ userId: requestedByUser.id, createdById: requestedByUser.id, spaceId: space.id });
				await delay(1000);
			})
		);
	}

	async getBlockOutDates(userId: number): Promise<UserEntity> {

		const user = await MainDataSource.getRepository(UserEntity).findOneOrFail({
			where: { id: userId },
			relations: ['adminVenues', 'adminVenues.blockOutDates'],
		});
		return user;
	}

	async saveBlockOutDates(venueId: number, body: any) {
		const blockOutDates: VenueBlockOutDatesEntity[] = body.blockOutDates;
		await Promise.all(
			blockOutDates?.map(async (blockOutDate) => {
				try {
					blockOutDate.venueId = venueId;
					await MainDataSource.getRepository(VenueBlockOutDatesEntity).save(blockOutDate);
				} catch (e) {
					loggerHelper.error('Error saving Blockout date - ', e);
				}
			})
		);
		return;
	}

	async deleteBlockOutDates(venueId: number, dateId: number) {
		await MainDataSource.getRepository(VenueBlockOutDatesEntity).delete({ id: dateId, venueId: venueId });
		return;
	}

}
