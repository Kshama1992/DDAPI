import BaseEntity from '@entity/base.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import SpaceEntity from '@entity/space.entity';
import VenueEntity from '@entity/venue.entity';
import SubscriptionEntity from '@entity/subscription.entity';
import ReservationEntity from '@entity/reservation.entity';
import UserEntity from '@entity/user.entity';
import InvoiceEntity from '@entity/invoice.entity';
import ColumnNumericTransformer from '@utils/transformer/numeric.transformer';
import ChargeType from 'dd-common-blocks/dist/type/ChargeType';
import InvoiceItemType from 'dd-common-blocks/dist/type/InvoiceItemType';
import DateWithTzTransformer from '@utils/transformer/date-with-tz';
import InvoiceItemInterface from '@interface/invoice-item.interface';

/**
 * Invoice Item entity
 * @category Entities
 * @subcategory Invoice
 * @extends BaseEntity
 */
@Entity({ name: 'InvoiceItem', schema: 'invoice' })
export default class InvoiceItemEntity extends BaseEntity implements InvoiceItemInterface {
	/**
	 * Inovice item name.(space name, deposit etc)
	 * @type {string}
	 */
	@Column({ nullable: true })
	name: string;

	/**
	 * Used credit hours
	 * @type {number}
	 */
	@Column('numeric', {
		transformer: new ColumnNumericTransformer(),
		default: 0,
		nullable: true,
	})
	creditHours: number;

	/**
	 * Refunded money amount for this item
	 * @type {number}
	 */
	@Column('numeric', {
		transformer: new ColumnNumericTransformer(),
		default: 0,
		nullable: true,
	})
	amountRefunded: number;

	/**
	 * Item price
	 * @type {number}
	 */
	@Column('numeric', {
		transformer: new ColumnNumericTransformer(),
		default: 0,
	})
	price: number;

	/**
	 * Item real price
	 * @type {number}
	 */
	@Column('numeric', {
		transformer: new ColumnNumericTransformer(),
		default: 0,
	})
	price2: number;

	/**
	 * If item refunded or not
	 * @type {boolean}
	 */
	@Column('boolean', { default: false })
	refunded: boolean;

	/**
	 * Payed money amount for this item
	 * @type {number}
	 */
	@Column('numeric', {
		transformer: new ColumnNumericTransformer(),
		default: 0,
	})
	paidAmount: number;

	/**
	 * Paid or not
	 * @type {boolean}
	 */
	@Column({ default: false })
	paid: boolean;

	/**
	 * Item tax in percent
	 * @type {number}
	 */
	@Column('numeric', {
		transformer: new ColumnNumericTransformer(),
		default: 0,
	})
	tax: number;

	/**
	 * Item quantity or hours
	 * @type {number}
	 */
	@Column('numeric', {
		precision: 7,
		scale: 2,
		transformer: new ColumnNumericTransformer(),
		default: 0,
	})
	quantity: number;

	@Column('numeric', {
		transformer: new ColumnNumericTransformer(),
		default: 0,
		nullable: true,
	})
	amenityHoursIncluded: number;

	/**
	 * Item bill cycle start date
	 * @type {Date}
	 */
	@Column({ type: 'timestamp with time zone', transformer: new DateWithTzTransformer(), nullable: true })
	startDate: Date;

	/**
	 * Item bill cycle end date
	 * @type {Date}
	 */
	@Column({ type: 'timestamp with time zone', transformer: new DateWithTzTransformer(), nullable: true })
	endDate: Date;

	/**
	 * Payment date
	 * @type {string}
	 */
	@Column({ nullable: true })
	payDate: string;

	/**
	 * Date bought. User can buy package and pay in few days
	 * @type {Date}
	 */
	@Column({ transformer: new DateWithTzTransformer(), type: 'timestamptz', nullable: true })
	dateBought: Date;

	/**
	 * Package (space) ID
	 * @type {number}
	 */
	@Index()
	@Column({ nullable: true })
	spaceId: number;

	/**
	 * Package (space) venue ID
	 * @type {number}
	 */
	@Index()
	@Column({ nullable: true })
	venueId: number;

	/**
	 * Created by ID
	 * @type {number}
	 */
	@Index()
	@Column({ nullable: true })
	createdById: number;

	@Column({ nullable: true })
	updatedById: number;

	@Index()
	@Column({ nullable: true })
	subscriptionId: number;

	@Index()
	@Column({ nullable: true })
	reservationId: number;

	@Index()
	@Column()
	invoiceId: number;

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'createdById' })
	createdBy: UserEntity;

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'updatedById' })
	updatedBy: UserEntity;

	@ManyToOne(() => SpaceEntity)
	@JoinColumn({ name: 'spaceId' })
	space: SpaceEntity;

	@ManyToOne(() => VenueEntity)
	@JoinColumn({ name: 'venueId' })
	venue: VenueEntity;

	@ManyToOne(() => SubscriptionEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'subscriptionId' })
	subscription: SubscriptionEntity;

	@ManyToOne(() => ReservationEntity)
	@JoinColumn({ name: 'reservationId' })
	reservation: ReservationEntity;

	/**
	 * Invoice item type
	 * @type {InvoiceItemType}
	 */
	@Column({
		type: 'enum',
		enum: InvoiceItemType,
	})
	invoiceItemType: InvoiceItemType;

	@Column({
		type: 'enum',
		enum: ChargeType,
	})
	chargeType: ChargeType;

	@ManyToOne(() => InvoiceEntity)
	@JoinColumn({ name: 'invoiceId' })
	invoice: InvoiceEntity;
}
