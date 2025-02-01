import VenueTypeEntity from '@entity/venue-type.entity';
import VenueEntity from '@entity/venue.entity';
import VenueTypeFilterRequest from '@src/dto/venuetype-filter-request';
import BaseService from '@services/base.service';
import { ForbiddenResponse } from '@utils/response/forbidden.response';
import UserEntity from '@entity/user.entity';
import { ErrorResponse } from '@utils/response/error.response';
import { Service } from 'typedi';
import MainDataSource from '@src/main-data-source';

/**
 * Venue type service
 */
@Service()
export default class VenueTypeService extends BaseService {
	constructor() {
		super();
		this.entity = VenueTypeEntity;
	}

	/**
	 * Get venue types list with filter
	 * @param {VenueTypeFilterRequest} params
	 * @promise {[VenueTypeEntity[], number]} A promise that contains the venue type array and counter.
	 */
	async list(params: VenueTypeFilterRequest): Promise<[VenueTypeEntity[], number]> {
		const { withChildren, withParent, withCache, onlyChildren, alias, brandId, limit = 10, offset = 0 } = params;

		// show space type only from dropdesk brand for not logged in user
		let query = MainDataSource.getRepository(VenueTypeEntity)
			.createQueryBuilder('VenueType')
			.where(brandId ? `VenueType.brandId = :brandId` : '1=1', { brandId })
			.andWhere(alias ? `VenueType.alias = :alias` : '1=1', { alias });

		if (withParent) {
			query = query.leftJoinAndSelect('VenueType.parent', 'parent');
		}

		if (withChildren) {
			query = query.leftJoinAndSelect('VenueType.children', 'children').andWhere('VenueType.parentId IS NULL');
		}

		if (onlyChildren) {
			query = query.andWhere('VenueType.parentId IS NOT NULL');
		}

		if (withCache) {
			query = query.cache(true);
		}

		return await query.take(limit).skip(offset).getManyAndCount();
	}

	/**
	 * Delete venue type if no venue
	 * @param id
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async delete(id: number, requestedByUser?: UserEntity | undefined) {
		const venueRepo = MainDataSource.getRepository(VenueEntity);
		const venueType = await MainDataSource.getRepository(VenueTypeEntity).findOneOrFail({ where: { id: +id } });

		if (!venueType._canDelete!(requestedByUser)) throw new ForbiddenResponse();

		const venueCount = await venueRepo.createQueryBuilder('Venue').andWhere('Venue.venueType = :id', { id }).getCount();

		if (venueCount > 0) {
			throw new ErrorResponse({ message: "Can't delete: Venue type have active venues!" });
		}

		return MainDataSource.getRepository(VenueTypeEntity).remove(venueType);
	}
}
