import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import BaseEntity from '@src/entity/base.entity';
import PaymentProvider from 'dd-common-blocks/dist/type/PaymentProvider';
import InvoiceEntity from '@entity/invoice.entity';
import UserEntity from '@entity/user.entity';

@Entity({ name: 'PaymentData', schema: 'invoice' })
export default class PaymentDataEntity extends BaseEntity {
	@Column({
		type: 'enum',
		enum: PaymentProvider,
	})
	provider: PaymentProvider;

	@Column({ default: true })
	paid: boolean;

	@Column({ default: false })
	refund: boolean;

	@Column({ default: false })
	securityRefund: boolean;

	@Column({ default: 0 })
	amount: number;

	@Column({ default: 0 })
	securityAmount: number;

	@Column()
	invoiceId: number;

	@Column()
	userId: number;

	@Column({
		type: 'jsonb',
		array: false,
	})
	data: any;

	@Column({
		type: 'jsonb',
		array: false,
	})
	securityDepositData: any;

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'userId' })
	user: UserEntity;

	@ManyToOne(() => InvoiceEntity)
	@JoinColumn({ name: 'invoiceId' })
	invoice: InvoiceEntity;
}
