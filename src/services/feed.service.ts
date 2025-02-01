import FeedEntity from '@entity/feed.entity';
import FeedLikeEntity from '@entity/feed-like.entity';
import FeedPinEntity from '@entity/feed-pin.entity';
import FeedCommentEntity from '@entity/feed-comment.entity';
import loggerHelper from '@helpers/logger.helper';
import { prepareImage, uploadToS3 } from '@helpers/s3';
import FeedFilter from 'dd-common-blocks/dist/interface/filter/feed-filter.interface';
import BaseService from '@services/base.service';
import UserEntity from '@entity/user.entity';
import MainDataSource from '@src/main-data-source';
import { Service } from 'typedi';

/**
 * Feed service
 */
@Service()
export default class FeedService extends BaseService {
	constructor() {
		super();
		this.entity = FeedEntity;
	}

	/**
	 * Get single feed
	 * @param id
	 */
	async single(id: number): Promise<FeedEntity | undefined> {
		return MainDataSource.getRepository(FeedEntity).findOneOrFail({
			where: { id },
			relations: ['pins', 'likes', 'comments', 'venue', 'brand', 'attachments'],
			cache: true,
		});
	}

	/**
	 * Create single feed
	 * @param data
	 */
	async create(data: Partial<FeedEntity>): Promise<FeedEntity> {
		const newFeed: FeedEntity = MainDataSource.getRepository(FeedEntity).create(data);
		const savedFeedItem = await MainDataSource.getRepository(FeedEntity).save(newFeed);
		if (data.uploadAttachments) {
			savedFeedItem.attachments = [];
			await Promise.all(
				data.uploadAttachments.map(async (attachment) => {
					try {
						const image64 = await prepareImage(attachment, 768);
						const file = await uploadToS3(image64, 'feeds', String(savedFeedItem.id), String(new Date().valueOf()));
						if (!savedFeedItem.attachments) savedFeedItem.attachments = [];
						savedFeedItem.attachments.push(file);
					} catch (e) {
						loggerHelper.error('image saving failed - ', e);
					}
				})
			);
			await MainDataSource.getRepository(FeedEntity).save(savedFeedItem);
		}
		return savedFeedItem;
	}

	/**
	 * Create feed comment
	 * @param data
	 * @param feedId
	 * @param {UserEntity} requestedByUser - Requested by user {@link UserEntity}
	 */
	async comment(feedId: number, data: Partial<FeedCommentEntity>, requestedByUser: UserEntity): Promise<FeedCommentEntity> {
		await MainDataSource.getRepository(FeedEntity).findOneOrFail({ where: { id: Number(feedId) } });

		const clone = { ...data, feedId: Number(feedId), userId: requestedByUser.id };
		const repo = MainDataSource.getRepository(FeedCommentEntity);
		const newComment: FeedCommentEntity = repo.create(clone);
		const savedItem = await repo.save(newComment);
		return await repo.findOneOrFail({ where: { id: savedItem.id }, relations: ['user', 'user.photo', 'user.brand'] });
	}

	/**
	 * Report feed
	 * @param feedId
	 */
	async report(feedId: number): Promise<FeedEntity> {
		const repo = MainDataSource.getRepository(FeedEntity);
		const item = await repo.findOneOrFail({ where: { id: Number(feedId) } });
		item.isReported = true;
		return await repo.save(item);
	}

	/**
	 * Like feed
	 * @param feedId
	 * @param user
	 */
	async like(feedId: number, user: UserEntity): Promise<FeedLikeEntity | undefined> {
		const repo = MainDataSource.getRepository(FeedEntity);
		const likeRepo = MainDataSource.getRepository(FeedLikeEntity);
		await repo.findOneOrFail({
			where: { id: feedId },
			select: ['id'],
		});

		const exist = await likeRepo.findOne({ where: { userId: user.id, feedId: feedId } });

		if (!exist) {
			const like = MainDataSource.getRepository(FeedLikeEntity).create({ userId: user.id, feedId });
			return await likeRepo.save(like);
		}
		await likeRepo.remove(exist);
		return exist;
	}

	/**
	 * Pin feed
	 * @param feedId
	 * @param user
	 */
	async pin(feedId: number, user: UserEntity): Promise<FeedPinEntity> {
		const repo = MainDataSource.getRepository(FeedEntity);
		const pinRepo = MainDataSource.getRepository(FeedPinEntity);
		await repo.findOneOrFail({ where: { id: feedId } });

		const exist = await pinRepo.findOne({ where: { userId: user.id, feedId } });

		if (!exist) {
			const pin = new FeedPinEntity();
			pin.userId = user.id;
			pin.feedId = feedId;
			return pinRepo.save(pin);
		}
		await pinRepo.remove(exist);
		return exist;
	}

	/**
	 * Get feeds list with filter
	 * @param params
	 */
	async list(params: FeedFilter): Promise<[FeedEntity[], number]> {
		let { brandId } = params;
		const { limit = 10, offset = 0, groupId, venueId, feedCategoryId, companyId, searchString } = params;

		if (brandId && groupId) brandId = undefined;

		return await MainDataSource.getRepository(FeedEntity)
			.createQueryBuilder('feed')
			.addSelect('feed.createdAt')
			.addSelect('comments.createdAt')
			.leftJoinAndSelect('feed.attachments', 'attachments')
			.leftJoinAndSelect('feed.user', 'user')
			.leftJoinAndSelect('user.photo', 'photo')
			.leftJoinAndSelect('user.brand', 'brand')
			.leftJoinAndSelect('feed.likes', 'likes')
			.leftJoinAndSelect('feed.pins', 'pins')
			.leftJoinAndSelect('feed.category', 'category')
			.leftJoinAndSelect('feed.comments', 'comments')
			.leftJoinAndSelect('comments.user', '__user__')
			.leftJoinAndSelect('__user__.photo', '__user__.photo')
			.leftJoinAndSelect('__user__.brand', '__user__.brand')
			.andWhere(brandId ? `feed.brand= :brandId` : '1=1', { brandId })
			.andWhere(groupId ? `feed.group= :groupId` : '1=1', { groupId })
			.andWhere(!groupId ? `feed.group IS NULL` : '1=1')
			.andWhere(!companyId ? `feed.company IS NULL` : '1=1')
			.andWhere(feedCategoryId ? `feed.category= :feedCategoryId` : '1=1', { feedCategoryId })
			.andWhere(venueId ? `feed.venue= :venueId` : '1=1', { venueId })
			.andWhere(searchString ? `LOWER(feed.message) LIKE LOWER(:searchString)` : '1=1', { searchString: `%${searchString}%` })
			.orderBy({
				'feed.createdAt': 'DESC',
				'comments.createdAt': 'DESC',
			})
			.take(limit)
			.skip(offset)
			.getManyAndCount();
	}

	async delete(id: number): Promise<FeedEntity> {
		const repo = MainDataSource.getRepository(FeedEntity);
		const commentsRepo = MainDataSource.getRepository(FeedCommentEntity);
		const likesRepo = MainDataSource.getRepository(FeedLikeEntity);
		const pinsRepo = MainDataSource.getRepository(FeedPinEntity);
		const item = await repo.findOneOrFail({ where: { id }, relations: ['likes', 'pins', 'comments'] });
		await Promise.all(item.comments!.map(async (l) => commentsRepo.remove(l)));
		await Promise.all(item.likes!.map(async (l) => likesRepo.remove(l)));
		await Promise.all(item.pins!.map(async (l) => pinsRepo.remove(l)));
		await repo.remove(item);
		return item;
	}
}
