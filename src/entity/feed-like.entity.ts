import BaseEntity from '@entity/base.entity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import FeedEntity from '@entity/feed.entity';

@Entity({ name: 'FeedLike', schema: 'feed' })
export default class FeedLikeEntity extends BaseEntity {
	@Column()
	feedId: number;

	@Column()
	userId: number;

	@ManyToOne(() => FeedEntity, (feed) => feed.likes)
	@JoinColumn({ name: 'feedId' })
	feed: Promise<FeedEntity>;
}
