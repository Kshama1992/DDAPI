import BaseEntity from '@entity/base.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import UserEntity from '@entity/user.entity';
import BrandEntity from '@entity/brand.entity';
import EmailTemplateTypeEntity from '@entity/email-template-type.entity';
import EntityStatus from 'dd-common-blocks/dist/type/EntityStatus';
import EmailLogEntity from '@entity/email-log.entity';
import { IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

@Entity({ name: 'EmailTemplate', schema: 'email' })
export default class EmailTemplateEntity extends BaseEntity {
	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'createdById' })
	createdBy: UserEntity;

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'updatedById' })
	updatedBy: UserEntity;

	@IsInt()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	brandId: number;

	@IsInt()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	updatedById: number;

	@IsInt()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	createdById: number;

	@ManyToOne(() => BrandEntity)
	@JoinColumn({ name: 'brandId' })
	brand: BrandEntity;

	@IsString()
	@IsOptional()
	@IsNotEmpty()
	@Column()
	name: string;

	@IsString()
	@IsOptional()
	@IsNotEmpty()
	@Column({ nullable: true })
	subject: string;

	@IsString()
	@IsOptional()
	@IsNotEmpty()
	@Column()
	fromEmail: string;

	@IsString()
	@IsOptional()
	@IsNotEmpty()
	@Column()
	fromName: string;

	@IsInt()
	@IsOptional()
	@Index()
	@Column()
	emailTemplateTypeId: number;

	@ManyToOne(() => EmailTemplateTypeEntity)
	@JoinColumn({ name: 'emailTemplateTypeId' })
	emailTemplateType: EmailTemplateTypeEntity;

	@OneToMany(() => EmailLogEntity, (el) => el.template)
	emailLogs?: EmailLogEntity;

	@IsOptional()
	@IsEnum(EntityStatus)
	@Column({
		type: 'enum',
		enum: EntityStatus,
		default: EntityStatus.ACTIVE,
	})
	status: EntityStatus;

	@IsString()
	@IsOptional()
	@Column()
	html: string;

	@IsObject()
	@IsOptional()
	@Column({
		type: 'jsonb',
		array: false,
	})
	unlayerDesign: any;
}
