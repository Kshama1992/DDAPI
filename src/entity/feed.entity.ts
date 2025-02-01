import BaseEntity from '@entity/base.entity';
import { Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany, Index } from 'typeorm';
import VenueEntity from '@entity/venue.entity';
import UserEntity from '@entity/user.entity';
import CompanyEntity from '@entity/company.entity';
import FileEntity from '@entity/file.entity';
import FeedCommentEntity from '@entity/feed-comment.entity';
import GroupEntity from '@entity/group.entity';
import FeedCategoryEntity from '@entity/feed-category.entity';
import BrandEntity from '@entity/brand.entity';
import FeedLikeEntity from '@entity/feed-like.entity';
import FeedPinEntity from '@entity/feed-pin.entity';
import FeedInterface from '@interface/feed.interface';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

@Entity({ name: 'Feed', schema: 'feed' })
export default class FeedEntity extends BaseEntity implements FeedInterface {
	@IsString()
	@IsNotEmpty()
	@Column()
	message: string;

	@IsBoolean()
	@IsOptional()
	@Column({ default: false })
	isReported: boolean;

	@IsInt()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	groupId: number;

	@IsInt()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	venueId: number;

	@IsInt()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	brandId: number;

	@IsInt()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	feedCategoryId: number;

	@IsInt()
	@Index()
	@Column()
	userId: number;

	@IsInt()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	companyId: number;

	@ManyToOne(() => BrandEntity)
	@JoinColumn({ name: 'brandId' })
	brand?: BrandEntity;

	@ManyToOne(() => FeedCategoryEntity)
	@JoinColumn({ name: 'feedCategoryId' })
	category?: FeedCategoryEntity;

	@ManyToOne(() => GroupEntity)
	@JoinColumn({ name: 'groupId' })
	group?: GroupEntity;

	@ManyToOne(() => VenueEntity)
	@JoinColumn({ name: 'venueId' })
	venue?: VenueEntity;

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'userId' })
	user?: UserEntity;

	@ManyToOne(() => CompanyEntity)
	@JoinColumn({ name: 'companyId' })
	company?: CompanyEntity;

	@ManyToMany(() => FileEntity, { cascade: true })
	@JoinTable({
		name: 'FeedAttachment',
		joinColumn: {
			name: 'feedId',
			referencedColumnName: 'id',
		},
		inverseJoinColumn: {
			name: 'fileId',
			referencedColumnName: 'id',
		},
	})
	attachments?: FileEntity[];

	uploadAttachments: string[];

	@OneToMany(() => FeedLikeEntity, (fl) => fl.feed)
	likes?: FeedLikeEntity[];

	@OneToMany(() => FeedPinEntity, (fl) => fl.feed)
	pins?: FeedPinEntity[];

	@OneToMany(() => FeedCommentEntity, (fl) => fl.feed)
	comments?: FeedCommentEntity[];

	@OneToMany(() => FeedCommentEntity, (fc) => fc.feed)
	feedConnectionUser?: Promise<UserEntity[]>;

	_canEdit?(user?: UserEntity | undefined) {
		if (!user) return false;
		return user.isSuperAdmin() || user.id === this.userId;
	}

	_canDelete?(user: UserEntity | undefined): boolean {
		return this._canEdit!(user);
	}
}
