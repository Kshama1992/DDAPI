import BaseEntity from '@entity/base.entity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import FeedEntity from '@entity/feed.entity';

@Entity({ name: 'FeedPin', schema: 'feed' })
export default class FeedPinEntity extends BaseEntity {
	@Column()
	feedId: number;

	@Column()
	userId: number;

	@ManyToOne(() => FeedEntity, (feed) => feed.pins)
	@JoinColumn({ name: 'feedId' })
	feed: FeedEntity;
}
