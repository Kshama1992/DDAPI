import BaseEntity from '@entity/base.entity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import UserEntity from '@entity/user.entity';
import InvoiceEntity from '@entity/invoice.entity';
import DateWithTzTransformer from '@utils/transformer/date-with-tz';

@Entity({ name: 'Refund', schema: 'refund' })
export default class RefundEntity extends BaseEntity {
	@Column()
	note: string;

	@Column()
	amount: number;

	@Column()
	securityAmount: number;

	@Column({ type: 'timestamp with time zone', transformer: new DateWithTzTransformer() })
	returnDate: Date;

	@Column()
	userId: number;

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'createdById' })
	createdBy: UserEntity;

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'updatedById' })
	updatedBy: UserEntity;

	@Column()
	createdById: number;

	@Column()
	updatedById: number;

	@Column()
	invoiceId: number;

	@ManyToOne(() => InvoiceEntity)
	@JoinColumn({ name: 'invoiceId' })
	invoice: InvoiceEntity;

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'userId' })
	user: UserEntity;
}
