import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import BaseEntity from '@src/entity/base.entity';
import PaymentProvider from 'dd-common-blocks/dist/type/PaymentProvider';
import InvoiceEntity from '@entity/invoice.entity';
import UserEntity from '@entity/user.entity';
import RefundEntity from '@entity/refund.entity';
import { Stripe } from 'stripe';

@Entity({ name: 'RefundData', schema: 'refund' })
export default class RefundDataEntity extends BaseEntity {
	@Column({
		type: 'enum',
		enum: PaymentProvider,
	})
	provider: PaymentProvider;

	@Column({ default: false })
	refund: boolean;

	@Column({ default: 0 })
	amount: number;

	@Column()
	securityAmount: number;

	@Column()
	invoiceId: number;

	@Column()
	userId: number;

	@Column()
	refundId: number;

	@Column({
		type: 'jsonb',
		array: false,
	})
	data: Stripe.Response<Stripe.Charge | Stripe.Refund | Stripe.PaymentIntent>;

	@ManyToOne(() => InvoiceEntity)
	@JoinColumn({ name: 'invoiceId' })
	invoice: InvoiceEntity;

	@ManyToOne(() => RefundEntity)
	@JoinColumn({ name: 'refundId' })
	refundItem: RefundEntity;

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'userId' })
	user: UserEntity;
}
