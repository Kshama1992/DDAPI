import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import DateWithTzTransformer from '@utils/transformer/date-with-tz';

export enum CronLogStatus {
	SUCCESS = 'success',
	FAILED = 'failed',
}

@Entity({ name: 'cron', schema: 'log' })
export default class CronLogEntity {
	/**
	 * Auto generated UID
	 */
	@PrimaryGeneratedColumn('uuid')
	id: number;

	/**
	 * Created at timestamp
	 */
	@Column({ default: new Date(), transformer: new DateWithTzTransformer(), type: 'timestamptz' })
	createdAt: Date;

	@Column()
	status: CronLogStatus;

	@Column()
	method: string;

	@Column()
	message: string;

	@Column()
	stack?: string;

	@Column()
	additional?: string;
}
