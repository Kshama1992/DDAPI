import BaseEntity from '@entity/base.entity';
import {
	Column,
	Entity,
	Index,
} from 'typeorm';
import { IsInt, IsOptional } from 'class-validator';

/**
 * Space entity
 * @category Entities
 * @subcategory Space
 * @extends BaseEntity
 */
@Entity({ name: 'PackageSpaceType', schema: 'space' })
export default class PackageSpaceTypeEntity extends BaseEntity {
		/**
	 * Space venue ID
	 * @type {number}
	 */
	@IsInt()
	@IsOptional()
	@Index()
	@Column()
	spaceTypeId: number;

    		/**
	 * Space venue ID
	 * @type {number}
	 */
	@IsInt()
	@IsOptional()
	@Index()
	@Column()
	spaceId: number;
}
