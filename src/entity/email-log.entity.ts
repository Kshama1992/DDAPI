import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Index } from "typeorm";
import BrandEntity from '@entity/brand.entity';
import EmailTemplateEntity from '@entity/email-template.entity';
import DateWithTzTransformer from '@utils/transformer/date-with-tz';

export enum EmailLogStatus {
	SUCCESS = 'success',
	FAILED = 'failed',
}

@Entity({ name: 'email', schema: 'log' })
export default class EmailLogEntity {
	/**
	 * Auto generated UID
	 */
	@PrimaryGeneratedColumn('increment')
	id: number;

	/**
	 * Created at timestamp
	 */
	@Column({ nullable: true, default: () => 'NOW()', transformer: new DateWithTzTransformer(), type: 'timestamptz' })
	createdAt: Date;

	@Column({ nullable: true, type: 'enum', enum: EmailLogStatus})
	status: EmailLogStatus;

	@Column({nullable: true})
	@Index()
	brandId: number;

	@Column({nullable: false, type: 'text'})
	subject: string;

	@Column({nullable: false})
	to: string;

	@Column({nullable: false})
	from: string;

	@Column({nullable: false, type: 'text'})
	message: string;

	@Column({nullable: true})
	@Index()
	templateId: number;

	@Column({
		type: 'jsonb',
		array: false,
		nullable: true,
	})
	variables: any;

	@Column({
		type: 'jsonb',
		array: false,
		nullable: true,
	})
	statusMessage: any;

	@ManyToOne(() => EmailTemplateEntity, t => t.emailLogs, {onDelete: "CASCADE" })
	@JoinColumn({ name: 'templateId' })
	template: EmailTemplateEntity;

	@ManyToOne(() => BrandEntity, b => b.emailLogs, {onDelete: "CASCADE" })
	@JoinColumn({ name: 'brandId' })
	brand: BrandEntity;
}
