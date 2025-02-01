import BaseEntity from '@entity/base.entity';
import { Column, Entity } from 'typeorm';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsNameUnique } from '@utils/validator/unique-name.validator';

/**
 * Amenity entity
 * @category Entities
 * @subcategory Space
 * @extends BaseEntity
 */
@Entity({ name: 'Amenity', schema: 'space' })
export default class AmenityEntity extends BaseEntity {
	/**
	 * Amenity name
	 */
	@IsString()
	@IsNotEmpty()
	@IsNameUnique()
	@Column()
	name: string;
}
