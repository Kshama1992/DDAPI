import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import PaymentProvider from 'dd-common-blocks/dist/type/PaymentProvider';
import InvoiceEntity from '@entity/invoice.entity';

/**
 * Invoice provider data entity
 * @category Entities
 * @subcategory Invoice
 * @extends BaseEntity
 */
@Entity({ name: 'InvoiceProviderData', schema: 'invoice' })
export default class InvoiceProviderDataEntity {
	@PrimaryGeneratedColumn('increment')
	id: number;

	@Column({
		type: 'enum',
		enum: PaymentProvider,
		default: PaymentProvider.STRIPE,
	})
	provider: PaymentProvider;

	@Column({ nullable: true })
	providerInvoiceId: string;

	@Column('varchar')
	providerInvoiceNumber: string;

	@Column()
	invoiceId: number;

	/**
	 * Invoice relation
	 * @type {InvoiceEntity}
	 */
	@ManyToOne(() => InvoiceEntity, (invoice) => invoice.providerData, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'invoiceId' })
	invoice: InvoiceEntity;
}
