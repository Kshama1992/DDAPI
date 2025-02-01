import BaseEntity from '@src/entity/base.entity';
import { Column, Entity } from 'typeorm';
import BrandEntity from '@entity/brand.entity';
import { IsOptional, IsString } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import BrandCategory from './brand-category.entity';

@Entity({ name: 'File', schema: 'public' })
export default class FileEntity extends BaseEntity {
	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'File name',
		example: 'logo.jpg',
	})
	@Column({ select: false })
	name: string;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'File url',
		example: '/static/space/123/logo.jpg',
	})
	@Column()
	url: string;

	logoBrand?: BrandEntity;

	iconBrand?: BrandCategory;

	bgBrand?: BrandEntity;
}
