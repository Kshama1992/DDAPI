import SpaceEntity from '@entity/space.entity';
import SpaceTypeEntity from '@entity/space-type.entity';
import UserEntity from '@entity/user.entity';
import SpacetypeFilterRequest from '@src/dto/spacetype-filter-request';
import BaseService from '@services/base.service';
import { ForbiddenResponse } from '@utils/response/forbidden.response';
import UserService from '@services/user.service';
import SubscriptionEntity from '@entity/subscription.entity';
import SpaceTypeLogicType from 'dd-common-blocks/dist/type/SpaceTypeLogicType';
import { Inject, Service } from 'typedi';
import MainDataSource from '@src/main-data-source';
import BrandService from '@services/brand.service';
import PackageShow from 'dd-common-blocks/dist/type/PackageShow';
import PackageSpaceTypeEntity from '@src/entity/package-space-type.entity';
import winstonLogger from '@src/utils/helpers/winston-logger';
import { FeatureFlag } from '@src/utils/feature-flag';

/**
 * Space service
 */
@Service()
export default class SpaceTypeService extends BaseService {
	brandService: BrandService;

	constructor(
		@Inject((type) => BrandService)
		brandService: BrandService
	) {
		super();
		this.brandService = brandService;
		this.entity = SpaceTypeEntity;
	}

	/**
	 * Get space types list with filter
	 *  - DD users and public (not authorized users) will see full list of space types
	 * @param {SpacetypeFilterRequest} params
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @promise {[SpaceTypeEntity[], number]} A promise that contains the space type array and counter.
	 */
	async list(params: SpacetypeFilterRequest, requestedByUser?: UserEntity | undefined): Promise<[SpaceTypeEntity[], number]> {
		let { brandId } = params;
		const { withChildren, withParent, onlyChildren, alias, withContactType } = params;
		const defaultBrand = await this.brandService.getDefaultBrand();
		let packageShowAsPublic = false;
		const subscriptionsSpaceTypes: number[] = [];
		const isBrandCatSubCat = await this.features.isEnabled(FeatureFlag.brandCategoryFlowEnabled);

		winstonLogger.info(`SpaceTypeService.list: requestedByUser: ${JSON.stringify(requestedByUser)}`);
		winstonLogger.info(`SpaceTypeService.list: brandId: ${JSON.stringify(brandId)}`);
		// show space type only from dropdesk brand for not logged in user
		if (!brandId && !requestedByUser) {
			
			winstonLogger.info('SpaceTypeService.list: brandId or requestedByUser is not provided, using default brand');
			brandId = defaultBrand.id;
		}

		if (requestedByUser && !requestedByUser.isAdmin && !requestedByUser.isSuperAdmin()) {
			winstonLogger.info('SpaceTypeService.list: requestedByUser is not admin or super admin');
			winstonLogger.info(`SpaceTypeService.list: requestedByUser.subscriptions: ${JSON.stringify(requestedByUser.subscriptions)}`);
			requestedByUser.subscriptions = await UserService._getSubscriptionsByUserId(requestedByUser.id, ['spaceTypes']);

			if ( requestedByUser?.subscriptions?.length && !isBrandCatSubCat) {
				const infoType = await MainDataSource.getRepository(SpaceTypeEntity).findOne({
					where: {
						logicType: SpaceTypeLogicType.INFO,
					},
				});

				const globalFilteredPackageList = await MainDataSource.getRepository(PackageSpaceTypeEntity).find({
					where: {
						spaceId : requestedByUser.subscriptions[0].spaceId
					},
				});


				if (infoType) subscriptionsSpaceTypes.push(infoType.id);

				requestedByUser.subscriptions.forEach((s: SubscriptionEntity) => {
					if(s?.space?.packageShow === PackageShow.PUBLIC)
					{
						packageShowAsPublic = true;
					}
					else{
					if (globalFilteredPackageList && globalFilteredPackageList.length) {
						globalFilteredPackageList.forEach((st) => {
							if (!subscriptionsSpaceTypes.includes(st.spaceTypeId)) subscriptionsSpaceTypes.push(st.spaceTypeId);
						});
					}
				}
				});
			}
		}

		let query = MainDataSource.getRepository(SpaceTypeEntity)
			.createQueryBuilder('SpaceType')
			.where(brandId ? `SpaceType.brandId = :brandId` : '1=1', { brandId })
			.andWhere(alias ? `SpaceType.alias = :alias` : '1=1', { alias });

		if (withParent) {
			query = query.leftJoinAndSelect('SpaceType.parent', 'parent');
		}

		if (withChildren) {
			query = query
				.leftJoinAndSelect('SpaceType.children', 'children')
				.andWhere('SpaceType.parentId IS NULL')
				.andWhere(
					(requestedByUser &&
						(requestedByUser.isSuperAdmin() || (requestedByUser.isAdmin && requestedByUser.brandId === defaultBrand.id))) ||
						withContactType
						? '1=1'
						: `SpaceType.alias != :infoName`,
					{ infoName: 'info-space' }
				);
		}

		if (onlyChildren) {
			query = query
				.andWhere('SpaceType.parentId IS NOT NULL')
				.andWhere(
					requestedByUser && (requestedByUser.isSuperAdmin() || (requestedByUser.isAdmin && requestedByUser.brandId === defaultBrand.id))
						? '1=1'
						: `SpaceType.logicType != :infoLogicType`,
					{ infoLogicType: SpaceTypeLogicType.INFO }
				);
		}

		if (!packageShowAsPublic && subscriptionsSpaceTypes.length) {
			query = query.andWhere('children.id IN (:...subscriptionsSpaceTypes)', { subscriptionsSpaceTypes });
		}

		return query.getManyAndCount();
	}

	/**
	 * Delete space type if no spaces
	 * @param id
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async delete(id: number, requestedByUser?: UserEntity | undefined) {
		const spaceType = await MainDataSource.getRepository(SpaceTypeEntity).findOneOrFail({ where: { id } });

		if (!spaceType._canDelete!(requestedByUser)) throw new ForbiddenResponse();

		const spacesCount = await MainDataSource.getRepository(SpaceEntity).count({ where: { spaceTypeId: +id } });

		if (spacesCount > 0) {
			throw new ForbiddenResponse({ message: "Can't delete: Space type have active spaces!" });
		}

		return MainDataSource.getRepository(SpaceTypeEntity).remove(spaceType);
	}
}
