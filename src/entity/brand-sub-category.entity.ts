import { Column,  Entity, Index, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { JSONSchema } from 'class-validator-jsonschema';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import BrandCategory from './brand-category.entity';

@Entity({ name: 'BrandSubCategory', schema: 'brand' })

export default class BrandSubCategory{

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

	@Index()
	@Column()
	name: string;

    @ManyToMany(() => BrandCategory, (f) => f.subCategories)
	brandCategory?: BrandCategory;

}
