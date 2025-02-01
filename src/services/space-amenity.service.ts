import SpaceAmenityFilter from 'dd-common-blocks/dist/interface/filter/space-amenity-filter.interface';
import SpaceAmenityEntity from '../entity/space-amenity.entity';
import BaseService from '@services/base.service';
import MainDataSource from '@src/main-data-source';
import { Inject, Service } from 'typedi';
import StripeService from '@services/stripe.service';
import UserEntity from '@entity/user.entity';
import CreateSpaceAmenityDto from '@src/dto/create-space-amenity.dto';
import UpdateSpaceAmenityDto from '@src/dto/update-space-amenity.dto';

/**
 * Space Amenity service
 */
@Service()
export default class SpaceAmenityService extends BaseService {
	@Inject()
	stripeService: StripeService;

	constructor() {
		super();
		this.entity = SpaceAmenityEntity;
	}

	/**
	 * Get single amenity
	 * @param id
	 */
	async single(id: number): Promise<SpaceAmenityEntity | undefined> {
		return MainDataSource.getRepository(SpaceAmenityEntity).findOneOrFail({ where: { id }, relations: ['amenity', 'space'] });
	}

	/**
	 * Get amenity list with filter
	 * @param params
	 */
	async list(params: SpaceAmenityFilter) {
		const { spaceId } = params;

		const query = MainDataSource.getRepository(SpaceAmenityEntity)
			.createQueryBuilder('SpaceAmenity')
			.innerJoinAndSelect('SpaceAmenity.space', 'space')
			.innerJoinAndSelect('SpaceAmenity.amenity', 'amenity')
			.andWhere(spaceId ? `SpaceAmenity.space = :spaceId` : '1=1', { spaceId })
			.cache(true);

		return await query.getManyAndCount();
	}

	/**
	 * Create amenity
	 * @param entity
	 * @param requestedByUser
	 */
	async create(entity: CreateSpaceAmenityDto, requestedByUser: UserEntity): Promise<SpaceAmenityEntity> {
		const obj = MainDataSource.getRepository(SpaceAmenityEntity).create(entity);
		const createdObj = await MainDataSource.getRepository(SpaceAmenityEntity).save(obj);

		await this.stripeService.createSpaceAmenityProduct({
			userId: requestedByUser.id,
			spaceAmenityId: createdObj.id,
		});
		return createdObj;
	}

	/**
	 * Update amenity
	 * @param id
	 * @param entity
	 * @param requestedByUser
	 */
	async update(id: number, entity: UpdateSpaceAmenityDto, requestedByUser: UserEntity): Promise<SpaceAmenityEntity> {
		const obj = await MainDataSource.getRepository(SpaceAmenityEntity).findOneOrFail({ where: { id } });
		const createdObj = await MainDataSource.getRepository(SpaceAmenityEntity).save({ ...obj, ...entity });

		const stripeProduct = await this.stripeService.updateSpaceAmenityProduct({
			userId: requestedByUser.id,
			spaceAmenityId: id,
			updatedById: requestedByUser.id,
		});

		// amenity price updated
		if (stripeProduct && entity.price && obj.price !== entity.price) {
			await this.stripeService.createSpaceAmenityPrice({
				userId: requestedByUser.id,
				createdById: requestedByUser.id,
				spaceAmenityId: id,
				price: entity.price,
				stripeProductId: stripeProduct.id,
			});
		}

		return createdObj;
	}

	/**
	 * Delete amenity
	 * @param id
	 * @param requestedByUser
	 */
	async delete(id: number, requestedByUser: UserEntity) {
		await MainDataSource.getRepository(SpaceAmenityEntity).findOneOrFail({ where: { id }, relations: ['providerData'] });
		try {
			await this.stripeService.deleteSpaceAmenityProduct({ userId: requestedByUser.id, spaceAmenityId: id });
		} catch (e) {
			console.error(e);
		}
		return await MainDataSource.getRepository(SpaceAmenityEntity).delete(id);
	}
}
