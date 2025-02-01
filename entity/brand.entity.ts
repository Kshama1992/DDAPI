import BaseEntity from '@src/entity/base.entity';
import { Column, JoinColumn, Entity, OneToMany, Index, ManyToOne, ManyToMany, JoinTable } from 'typeorm';
import FileEntity from '@src/entity/file.entity';
import BrandInterface from 'dd-common-blocks/dist/interface/brand.interface';
import EmailLogEntity from '@entity/email-log.entity';
import UserEntity from '@entity/user.entity';
import EmailTemplateEntity from '@entity/email-template.entity';
import { IsBase64, IsBoolean, IsNotEmpty, IsNotEmptyObject, IsObject, IsOptional, IsString } from 'class-validator';
import { IsDomainUnique } from '@utils/validator/unique-domain.validator';
import { JSONSchema } from 'class-validator-jsonschema';
import BrandCategory from './brand-category.entity';

/**
 * Brand entity
 * @category Entities
 * @subcategory Brand
 * @extends BaseEntity
 */
@Entity({ name: 'Brand', schema: 'brand' })
export default class BrandEntity extends BaseEntity implements BrandInterface {
	@IsString({ message: 'Name is required!' })
	@IsNotEmpty()
	@JSONSchema({
		description: 'Brand name',
		example: 'Awesome brand name',
	})
	@Column()
	@Index()
	name: string;

	@IsString()
	@IsOptional()
	@IsNotEmpty()
	@IsDomainUnique()
	@JSONSchema({
		description: 'Brand domain',
		example: 'dropdesk',
	})
	@Column({ nullable: true })
	@Index()
	domain: string;

	@IsString()
	@IsOptional()
	@Column({ select: false, nullable: true })
	stripePublicKey?: string;

	@IsString()
	@IsOptional()
	@Column({ select: false, nullable: true })
	stripePrivateKey?: string;

	@IsString()
	@IsOptional()
	@Column({ select: false, nullable: true })
	stripewebhooksecret?: string;

	@IsString()
	@IsOptional()
	@Column({ select: true, nullable: true })
	brandCategory?: string;

	@IsOptional()
	@ManyToMany(() => BrandCategory)
	@JoinTable({
		name: 'BrandSpecificCategory',
		joinColumn: {
			name: 'brandId',
			referencedColumnName: 'id',
		},
		inverseJoinColumn: {
			name: 'brandCategoryId',
			referencedColumnName: 'id',
		},
	})
	brandCategories: BrandCategory[];


	@ManyToOne(() => FileEntity, (f) => f.logoBrand)
	@JoinColumn({ name: 'logoFileId' })
	logo?: FileEntity;

	@ManyToOne(() => FileEntity, (f) => f.bgBrand)
	@JoinColumn({ name: 'backgroundFileId' })
	background?: FileEntity;

	@OneToMany(() => EmailLogEntity, (el) => el.brand)
	emailLogs?: EmailLogEntity;

	@OneToMany(() => EmailTemplateEntity, (el) => el.brand, { onDelete: 'CASCADE', onUpdate: 'NO ACTION' })
	emailTemplates?: EmailTemplateEntity[];

	@IsBoolean()
	@IsOptional()
	@JSONSchema({
		description: 'Charge customer?',
		example: true,
		default: true,
	})
	@Column({ default: true })
	chargeCustomer: boolean;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'User terms HTML',
		example:
			'<!DOCTYPE HTML PUBLIC "-//W3C//DTD XHTML 1.0 Transitional //EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">\n' +
			'<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">\n' +
			'<head>\n' +
			'  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">\n' +
			'  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
			'  <meta name="x-apple-disable-message-reformatting">\n' +
			'  <!--[if !mso]><!--><meta http-equiv="X-UA-Compatible" content="IE=edge"><!--<![endif]-->\n' +
			'  <title></title>\n' +
			'</head>\n' +
			'<body class="clean-body u_body">\n' +
			'</body>\n' +
			'</html>',
	})
	@Column({ select: false, nullable: true })
	userTerms?: string;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'User privacy policy HTML',
		example:
			'<!DOCTYPE HTML PUBLIC "-//W3C//DTD XHTML 1.0 Transitional //EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">\n' +
			'<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">\n' +
			'<head>\n' +
			'  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">\n' +
			'  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
			'  <meta name="x-apple-disable-message-reformatting">\n' +
			'  <!--[if !mso]><!--><meta http-equiv="X-UA-Compatible" content="IE=edge"><!--<![endif]-->\n' +
			'  <title></title>\n' +
			'</head>\n' +
			'<body class="clean-body u_body">\n' +
			'</body>\n' +
			'</html>',
	})
	@Column({ select: false, nullable: true })
	privacyPolicy?: string;

	@Column({ nullable: true })
	logoFileId?: number;

	@Column({ nullable: true })
	backgroundFileId?: number;

	@IsString()
	@IsBase64()
	@IsOptional()
	@JSONSchema({
		description: 'Brand logo base64',
		example: 'data:image/png;base64, _______',
	})
	uploadLogo?: string;

	@IsString()
	@IsBase64()
	@IsOptional()
	@JSONSchema({
		description: 'Brand background base64',
		example: 'data:image/png;base64, _______',
	})
	uploadBg?: string;

	@IsObject()
	@IsNotEmptyObject()
	@IsOptional()
	@JSONSchema({
		description: `Unlayer Privacy Policy json object`,
	})
	@Column({
		type: 'jsonb',
		array: false,
		select: false,
		nullable: true,
	})
	unlayerPP?: any;

	@IsObject()
	@IsNotEmptyObject()
	@IsOptional()
	@JSONSchema({
		description: `Unlayer Terms of service json object`,
	})
	@Column({
		type: 'jsonb',
		array: false,
		select: false,
		nullable: true,
	})
	unlayerTOS?: any;

	_canEdit?(user: UserEntity | undefined): boolean {
		if (!user) return false;
		if (user.isSuperAdmin()) return true;
		return user.isAdmin && user.brandId === this.id;
	}

	_canDelete?(user: UserEntity | undefined): boolean {
		return !!(user && user.isSuperAdmin());
	}
}
