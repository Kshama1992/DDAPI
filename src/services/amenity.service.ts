import { Service } from 'typedi';
import AmenityEntity from '@entity/amenity.entity';
import BaseService from './base.service';
import MainDataSource from '@src/main-data-source';
import SpaceAmenityEntity from '../entity/space-amenity.entity';
import UserEntity from '@src/entity/user.entity';
import AmenityFilterRequest from '@src/dto/amenity-filter-request';

/**
 * Handle all actions with Amenity.
 * @module AmenityService
 * @category Services
 */
@Service()
export default class AmenityService extends BaseService {
	constructor() {
		super();
		this.entity = AmenityEntity;
	}

	async listTopAmenities(limit: number): Promise<[AmenityEntity[], number]> {
		const result = await MainDataSource.getRepository(SpaceAmenityEntity)

			.createQueryBuilder('SpaceAmenity')
			.leftJoin(AmenityEntity, 'Amenity', '"SpaceAmenity"."amenityId" = "Amenity"."id"')
			.select('"SpaceAmenity"."amenityId"')
			.addSelect('"Amenity"."name"')
			.addSelect('COUNT(*)', 'count')
			.groupBy('"SpaceAmenity"."amenityId"')
			.addGroupBy('"Amenity"."name"')
			.orderBy('count', 'DESC')
			.limit(limit)
			.getRawMany();

		const amenities = result.map((rawResult) => {
			const amenity = new AmenityEntity();
			amenity.id = rawResult.amenityId;
			amenity.name = rawResult.name;
			return amenity;
		});

		return [amenities, amenities.length];
	}

	async list(params: AmenityFilterRequest, requestedByUser?: UserEntity | undefined): Promise<[AmenityEntity[], number]> {
		if (params.sort === 'top') {
			return this.listTopAmenities(params.limit);
		}
		const query = MainDataSource.getRepository(AmenityEntity).createQueryBuilder('amenity');

		return query.getManyAndCount();
	}
}
