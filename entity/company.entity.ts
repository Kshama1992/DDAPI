import BaseEntity from '@entity/base.entity';
import { Column, Entity, Index, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany } from 'typeorm';
import UserEntity from '@entity/user.entity';
import BrandEntity from '@entity/brand.entity';
import VenueEntity from '@entity/venue.entity';
import FileEntity from '@entity/file.entity';
import CompanyMemberEntity from '@entity/company-member.entity';
import { JSONSchema } from 'class-validator-jsonschema';
import CompanyInterface from '@interface/company.interface';
import TeamEntity from './team.entity';
import { IsArray, IsEmail, IsFQDN, IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsNameUnique } from '@utils/validator/unique-name.validator';

@JSONSchema({
	description: 'A Company object',
})
@Entity({ name: 'Company', schema: 'company' })
export default class CompanyEntity extends BaseEntity implements CompanyInterface {
	@IsString()
	@IsNotEmpty()
	@JSONSchema({
		description: 'A Company name',
		example: 'My company',
	})
	@IsNameUnique()
	@Column()
	name: string;

	@JSONSchema({
		description: 'Updated user by object',
	})
	@Type(() => UserEntity)
	@ValidateNested()
	@IsOptional()
	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'updatedById' })
	updatedBy: UserEntity;

	@JSONSchema({
		description: 'Created user by object',
	})
	@Type(() => UserEntity)
	@ValidateNested()
	@IsOptional()
	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'createdById' })
	createdBy: UserEntity;

	@IsInt()
	@IsOptional()
	@JSONSchema({
		description: 'Company phone',
		example: 380500000000,
	})
	@Column({ type: 'integer', nullable: true })
	phone: number;

	@IsEmail()
	@IsOptional()
	@JSONSchema({
		description: 'Company email',
		example: 'company@mail.com',
	})
	@Column({ nullable: true })
	email: string;

	@IsInt()
	@Index()
	@IsOptional()
	@Column()
	@JSONSchema({
		description: 'Created by user ID',
		example: 245,
	})
	createdById: number;

	@IsInt()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	@JSONSchema({
		description: 'Updated by user ID',
		example: 245,
	})
	updatedById: number;

	@IsOptional()
	@IsString()
	@JSONSchema({
		description: 'About company',
		example:
			'Proin eget tortor risus. Vestibulum ac diam sit amet quam vehicula elementum sed sit amet dui. Nulla porttitor accumsan tincidunt. Curabitur aliquet quam id dui posuere blandit. Praesent sapien massa, convallis a pellentesque nec, egestas non nisi. Cras ultricies ligula sed magna dictum porta. Pellentesque in ipsum id orci porta dapibus. Donec sollicitudin molestie malesuada.',
	})
	@Column({ nullable: true, default: '' })
	about: string;

	@IsFQDN()
	@IsOptional()
	@JSONSchema({
		description: 'Company website',
		example: 'google.com',
	})
	@Column({ nullable: true })
	website: string;

	@IsOptional()
	@IsString()
	@JSONSchema({
		description: 'Company services',
		example: ['cleaning', 'doing things'],
	})
	@Column({ type: 'simple-array', nullable: true })
	services: string;

	@IsInt()
	@IsNotEmpty()
	@IsOptional()
	@Index()
	@JSONSchema({
		description: 'Company brand ID',
		example: 11,
	})
	@Column()
	brandId: number;

	@IsInt()
	@Index()
	@IsOptional()
	@JSONSchema({
		description: 'Company venue ID',
		example: 34,
	})
	@Column({ nullable: true })
	venueId: number;

	@IsOptional()
	@Type(() => BrandEntity)
	@ValidateNested()
	@ManyToOne(() => BrandEntity)
	@JoinColumn({ name: 'brandId' })
	brand: BrandEntity;

	@IsOptional()
	@Type(() => VenueEntity)
	@ValidateNested()
	@ManyToOne(() => VenueEntity)
	@JoinColumn({ name: 'venueId' })
	venue: VenueEntity;

	@IsOptional()
	@IsArray()
	@Type(() => FileEntity)
	@ValidateNested({ each: true })
	@ManyToMany(() => FileEntity, { cascade: true })
	@JoinTable({
		name: 'CompanyPhoto',
		joinColumn: {
			name: 'companyId',
			referencedColumnName: 'id',
		},
		inverseJoinColumn: {
			name: 'fileId',
			referencedColumnName: 'id',
		},
	})
	photos: FileEntity[];

	@IsOptional()
	@IsArray()
	@Type(() => TeamEntity)
	@ValidateNested({ each: true })
	@ManyToMany(() => TeamEntity, { cascade: true })
	@JoinTable({
		name: 'CompanyTeam',
		joinColumn: {
			name: 'companyId',
			referencedColumnName: 'id',
		},
		inverseJoinColumn: {
			name: 'teamId',
			referencedColumnName: 'id',
		},
	})
	teams: TeamEntity[];

	@IsOptional()
	@IsArray()
	@Type(() => CompanyMemberEntity)
	@ValidateNested({ each: true })
	@OneToMany(() => CompanyMemberEntity, (fc) => fc.company, { onDelete: 'CASCADE' })
	members: CompanyMemberEntity[];

	/**
	 * this using when u want to add new image or replace old image
	 */
	@IsOptional()
	@IsArray()
	@JSONSchema({
		description: 'Use when u need to upload new company images. Base64 images array',
		example: '["data:image/png;base64, _______", "data:image/png;base64, _______"]',
	})
	uploadAttachments?: string[];

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'Use when u need to upload new company image. Base64 image',
		example: 'data:image/png;base64, _______',
	})
	image?: string;

	_canDelete?(user: UserEntity | undefined): boolean {
		return this._canEdit!(user);
	}

	_canEdit?(user?: UserEntity | undefined) {
		if (!user) return false;
		return user.isSuperAdmin() || user.id === this.createdById || (user.brandId === this.brandId && user.isAdmin);
	}
}
