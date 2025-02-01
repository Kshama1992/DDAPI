import BaseEntity from '@entity/base.entity';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import BrandEntity from '@entity/brand.entity';
import FeedEntity from '@entity/feed.entity';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';

@Entity({ name: 'FeedCategory ', schema: 'feed' })
export default class FeedCategoryEntity extends BaseEntity {
	@IsString()
	@IsNotEmpty()
	@Column()
	name: string;

	@IsInt()
	@IsNotEmpty()
	@Column()
	brandId: number;

	@ManyToOne(() => BrandEntity)
	@JoinColumn({ name: 'brandId' })
	brand: BrandEntity;

	@OneToMany(() => FeedEntity, (fc) => fc.category)
	feed: FeedEntity[];
}
