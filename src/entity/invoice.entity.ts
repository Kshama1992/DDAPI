import BaseEntity from '@entity/base.entity';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, Index } from 'typeorm';
import UserEntity from '@entity/user.entity';
import ReservationEntity from '@entity/reservation.entity';
import SubscriptionEntity from '@entity/subscription.entity';
import SpaceEntity from '@entity/space.entity';
import VenueEntity from '@entity/venue.entity';
import InvoiceStatusEntity from '@entity/invoice-status.entity';
import InvoiceItemEntity from '@entity/invoice-item.entity';
import ColumnNumericTransformer from '@utils/transformer/numeric.transformer';
import BrandEntity from '@entity/brand.entity';
import PaymentDataEntity from '@entity/payment-data';
import RefundEntity from '@entity/refund.entity';
import InvoiceInterface from '@interface/invoice.interface';
import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import InvoiceProviderDataEntity from '@entity/invoice-provider-data.entity';
import Stripe from 'stripe';
import SecurityDepositStatusEntity from './securityDeposit-status.entity';
import PaymentModeEntity from './payment-mode.entity';

/**
 * Invoice entity
 * @category Entities
 * @subcategory Invoice
 * @extends BaseEntity
 */
@Entity({ name: 'Invoice', schema: 'invoice' })
export default class InvoiceEntity extends BaseEntity implements InvoiceInterface {
	/**
	 * Invoice subtotal. Total without tax
	 * @type {number}
	 */
	@IsNumber()
	@IsOptional()
	@Column('numeric', {
		transformer: new ColumnNumericTransformer(),
		default: 0,
	})
	subTotal: number;

	/**
	 * Payed by user amount
	 * @type {number}
	 */
	@IsNumber()
	@IsOptional()
	@Column('numeric', {
		transformer: new ColumnNumericTransformer(),
		default: 0,
	})
	paidAmount: number;

	/**
	 * Invoice paid or not
	 * @type {boolean}
	 */
	@IsBoolean()
	@IsOptional()
	@Column({ default: false })
	paid: boolean;

	/**
	 * Invoice tax in money equivalent (not percentage)
	 * @type {number}
	 */
	@IsNumber()
	@IsOptional()
	@Column('numeric', {
		transformer: new ColumnNumericTransformer(),
		default: 0,
	})
	tax: number;

	/**
	 * Created by ID
	 * @type {number}
	 */
	@IsInt()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	createdById: number;

	/**
	 * Updated by ID
	 * @type {number}
	 */
	@IsInt()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	updatedById: number;

	/**
	 * Payment failure message.
	 * @type {string}
	 */
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	failureMessage: string;


	@IsBoolean()
	@IsOptional()
	@Column({ default: true })
	instantlyBookableRequested: boolean;


	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	instantlyBookableResponse: string;

	@IsBoolean()
	@IsOptional()
	@Column()
	instantlyBookReqAutoDecline: boolean;

	@IsBoolean()
	@IsOptional()
	@Column({ default: false })
	reminderSend: boolean;

	@IsBoolean()
	@IsOptional()
	@Column({ default: false })
	reBookingReminder: boolean;

	/**
	 * Issued to user ID
	 * @type {number}
	 */
	@IsInt()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	userId: number;

	/**
	 * Is invoice refunded
	 * @type {boolean}
	 */
	@IsBoolean()
	@IsOptional()
	@Column()
	refund: boolean;

	/**
	 * Invoice number (not and ID)
	 * @type {number}
	 */
	@IsInt()
	@IsOptional()
	@Column()
	invoiceNumber: number;

	/**
	 * Is invoice will be autobillable
	 * @todo delete this
	 * @type {boolean}
	 */
	@IsBoolean()
	@IsOptional()
	@Column({ default: false })
	autoBillable: boolean;

	/**
	 * Auto send email
	 * @todo delete this
	 * @type {boolean}
	 */
	@IsBoolean()
	@IsOptional()
	@Column({ default: false })
	autoSendEmail: boolean;

	/**
	 * Invoice reservation ID
	 * @type {number | null}
	 */
	@IsInt()
	@IsOptional()
	@IsNotEmpty()
	@Index()
	@Column({ nullable: true })
	reservationId: number | null;

	/**
	 * Invoice subscription ID
	 * @type {number | null}
	 */
	@IsInt()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	subscriptionId?: number;

	/**
	 * Invoice team ID
	 * @type {number | null}
	 */
	@IsInt()
	@IsOptional()
	@Column({ nullable: true })
	teamId?: number;

	/**
	 * Invoice space ID
	 * @type {number | null}
	 */
	@IsInt()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	spaceId: number;

	/**
	 * Invoice venue ID
	 * @type {number | null}
	 */
	@IsInt()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	venueId: number;

	/**
	 * Invoice brand ID
	 * @type {number}
	 */
	@IsInt()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	brandId: number;

	/**
	 * Invoice status ID
	 * @type {number}
	 */
	@IsInt()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	invoiceStatusId: number;

	/**
	 * Invoice status ID
	 * @type {number}
	 */
	@IsInt()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	securityDepositStatusId: number;


	/**
	 * Invoice processing date
	 * @type {string}
	 */
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	processDate: string;

	/**
	 * Invoice payment date
	 * @type {string}
	 */
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	payDate: string;

	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	refundDate: string;

	/**
	 * Invoice currency
	 * @type {string}
	 */
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	currency: string;

	/**
	 * Relations
	 */

	/**
	 * Created by User
	 * @type {UserEntity}
	 */
	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'createdById' })
	createdBy: UserEntity;

	/**
	 * Updated by User
	 * @type {UserEntity}
	 */
	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'updatedById' })
	updatedBy: UserEntity;

	/**
	 * Invoice reservation relation
	 * @type {ReservationEntity | null}
	 */
	@ManyToOne(() => ReservationEntity)
	@JoinColumn({ name: 'reservationId' })
	reservation: ReservationEntity | null;

	/**
	 * Invoice subscription relation
	 * @type {SubscriptionEntity | null}
	 */
	@ManyToOne(() => SubscriptionEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'subscriptionId' })
	subscription: SubscriptionEntity;

	/**
	 * Invoice space relation.
	 * @type {SpaceEntity | null}
	 */
	@ManyToOne(() => SpaceEntity, (space) => space.invoice)
	@JoinColumn({ name: 'spaceId' })
	space: SpaceEntity;

	/**
	 * Invoice venue relation
	 * @type {VenueEntity | null}
	 */
	@ManyToOne(() => VenueEntity)
	@JoinColumn({ name: 'venueId' })
	venue: VenueEntity;

	/**
	 * Invoice brand relation
	 * @type {BrandEntity}
	 */
	@ManyToOne(() => BrandEntity)
	@JoinColumn({ name: 'brandId' })
	brand: BrandEntity;

	/**
	 * Invoice status relation
	 * @type {InvoiceStatusEntity}
	 */
	@ManyToOne(() => InvoiceStatusEntity)
	@JoinColumn({ name: 'invoiceStatusId' })
	invoiceStatus?: InvoiceStatusEntity;

	/**
	 * Invoice status relation
	 * @type {SecurityDepositStatusEntity}
	 */
	@ManyToOne(() => SecurityDepositStatusEntity)
	@JoinColumn({ name: 'securityDepositStatusId' })
	securityDepositStatus?: SecurityDepositStatusEntity;

	
	@ManyToOne(() => PaymentModeEntity)
	@JoinColumn({ name: 'paymentModeId' })
	paymentMode?: number;

	/**
	 * Invoice issued to user
	 * @type {UserEntity}
	 */
	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'userId' })
	issuedTo: UserEntity;

	/**
	 * Invoice items array
	 * @type {InvoiceItemEntity[]}
	 */
	@OneToMany(() => InvoiceItemEntity, (invoiceItem) => invoiceItem.invoice, { cascade: true })
	items: InvoiceItemEntity[];

	/**
	 * Invoice payment data
	 * @type {PaymentDataEntity[] | null}
	 */
	@OneToMany(() => PaymentDataEntity, (paymentData) => paymentData.invoice, { cascade: true, persistence: false })
	paymentData: PaymentDataEntity[];

	/**
	 * Invoice refund data
	 * @type {RefundEntity[] | null}
	 */
	@OneToMany(() => RefundEntity, (refundData) => refundData.invoice, { cascade: true })
	refundData: RefundEntity[];

	/**
	 * Invoice payment provider data
	 * @type {InvoiceProviderDataEntity[]}
	 */
	@OneToMany(() => InvoiceProviderDataEntity, (invoiceProviderDataEntity) => invoiceProviderDataEntity.invoice, {
		persistence: false,
		onDelete: 'CASCADE',
	})
	providerData: InvoiceProviderDataEntity[];

	/**
	 * Next types are for API requsts
	 */

	/**
	 * Refund note
	 * @type {string | undefined}
	 */
	@IsString()
	@IsOptional()
	refundNote?: string;

	/**
	 * Refund amount
	 * @type {number}
	 */
	@IsInt()
	@IsOptional()
	refundAmount?: number;

	stripeInvoice?: Stripe.Invoice;

	_canCreate?(user?: UserEntity | undefined) {
		return !!user;
	}

	_canEdit?(user?: UserEntity | undefined) {
		if (!user) return false;
		return user.isSuperAdmin() || user.id === this.userId || (user.brandId === this.brandId && user.isAdmin);
	}
}
