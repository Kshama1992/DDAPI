import FeedEntity from '@entity/feed.entity';
import FeedLikeEntity from '@entity/feed-like.entity';
import FeedPinEntity from '@entity/feed-pin.entity';
import FeedCategoryEntity from '@entity/feed-category.entity';
import FeedCategoryFilter from 'dd-common-blocks/dist/interface/filter/feed-category-filter.interface';
import BaseService from '@services/base.service';
import { ForbiddenResponse } from '@utils/response/forbidden.response';
import UserEntity from '@entity/user.entity';
import { Service } from 'typedi';
import MainDataSource from '@src/main-data-source';

/**
 * Feed category service
 */
@Service()
export default class FeedCategoryService extends BaseService {
	constructor() {
		super();
		this.entity = FeedCategoryEntity;
	}

	/**
	 * Get feed categories list with filter
	 * @param params
	 */
	async list(params: FeedCategoryFilter): Promise<[FeedCategoryEntity[], number]> {
		const { brandId, searchString } = params;

		return await MainDataSource.getRepository(FeedCategoryEntity)
			.createQueryBuilder('feedCategory')
			.leftJoinAndSelect('feedCategory.brand', 'brand')
			.andWhere(brandId ? `feedCategory.brand= :brandId` : '1=1', { brandId })
			.andWhere(searchString ? `LOWER(feedCategory.name) LIKE LOWER(:searchString)` : '1=1', { searchString: `%${searchString}%` })
			.orderBy({
				'feedCategory.name': 'ASC',
			})
			.getManyAndCount();
	}

	/**
	 *
	 * @param id
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async delete(id: number, requestedByUser?: UserEntity | undefined): Promise<FeedCategoryEntity> {
		const categoryRepo = MainDataSource.getRepository(FeedCategoryEntity);
		const repo = MainDataSource.getRepository(FeedEntity);
		const likesRepo = MainDataSource.getRepository(FeedLikeEntity);
		const pinsRepo = MainDataSource.getRepository(FeedPinEntity);

		const cat = await categoryRepo.findOneOrFail({ where: { id } });

		if (!cat._canDelete!(requestedByUser)) throw new ForbiddenResponse();

		const items = await repo.find({ where: { feedCategoryId: +id }, relations: ['likes', 'pins'] });

		await Promise.all(
			items.map(async (feed: FeedEntity) => {
				await Promise.all(feed.likes!.map(async (l) => likesRepo.remove(l)));
				await Promise.all(feed.pins!.map(async (l) => pinsRepo.remove(l)));
				await repo.remove(feed);
			})
		);

		await categoryRepo.remove(cat);
		return cat;
	}
}
