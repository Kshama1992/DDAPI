import { Column, JoinColumn, Entity, Index, ManyToOne, ManyToMany, JoinTable, PrimaryGeneratedColumn } from 'typeorm';
import FileEntity from '@src/entity/file.entity';
import { IsInt,IsBase64, IsNotEmpty,  IsOptional,  IsString } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import BrandSubCategory from './brand-sub-category.entity';

@Entity({ name: 'BrandCategory', schema: 'brand' })
export default class BrandCategory {

	@IsInt()
	@IsOptional()
	@JSONSchema({
		description: 'Auto generated ID',
		example: 534,
	})
	@PrimaryGeneratedColumn('increment')
	id: number; 
	
	@IsString({ message: 'Name is required!' })
	@IsNotEmpty()
	@JSONSchema({
		description: 'Brand category name',
		example: 'Awesome brand category',
	})
	@Column()
	@Index()
	categoryName: string;

	@Column({ nullable: true })
	iconFileID?: number;

	@Column({ nullable: true })
	url?: string;

    @ManyToOne(() => FileEntity, (f) => f.iconBrand)
	@JoinColumn({ name: 'iconFileID' })
	icon?: FileEntity;

	@IsOptional()
	@ManyToMany(() => BrandSubCategory)
	@JoinTable({
		name: 'BrandCategorySubCategory',
		joinColumn: {
			name: 'brandCategotyId',
			referencedColumnName: 'id',
		},
		inverseJoinColumn: {
			name: 'subCategoryId',
			referencedColumnName: 'id',
		},
	})
	subCategories?: BrandSubCategory[]	;

	@IsString()
	@IsBase64()
	@IsOptional()
	@JSONSchema({
		description: 'Brand icon base64',
		example: 'data:image/png;base64, _______',
	})
	uploadIcon?: string;

}
