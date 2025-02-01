import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import BaseEntity from '@entity/base.entity';
import UserEntity from '@entity/user.entity';
import FeedEntity from '@entity/feed.entity';
import FeedCommentInterface from '@interface/feed-comment.interface';

@Entity({ name: 'FeedComment', schema: 'feed' })
export default class FeedCommentEntity extends BaseEntity implements FeedCommentInterface {
	@Column()
	feedId: number;

	@Column()
	userId: number;

	@Column()
	comment: string;

	@ManyToOne(() => FeedEntity, (feed) => feed.comments)
	@JoinColumn({ name: 'feedId' })
	feed: Promise<FeedEntity>;

	@ManyToOne(() => UserEntity, (user) => user.userConnectionFeed)
	@JoinColumn({ name: 'userId' })
	user: Promise<UserEntity>;
}
