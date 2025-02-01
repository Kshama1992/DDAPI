import type BaseInterface from './base.interface';
import type VenueInterface from './venue.interface';
import type UserInterface from './user.interface';
import type ReservationInterface from './reservation.interface';
import type SubscriptionInterface from './subscription.interface';
import type SpaceInterface from './space.interface';
import type InvoiceInterface from './invoice.interface';
import type ChargeType from '@utils/constants/charge-type';
export declare enum InvoiceItemType {
    DISCOUNT = "discount",
    EXTRA = "extra",
    SPACE = "space",
    AMENITY = "amenity",
    SECURITY_DEPOSIT = "security_deposit"
}
export declare enum InvoiceItemPaymentType {
    BANKNOTES = "banknotes",
    HOURS = "hours"
}
export default interface InvoiceItemInterface extends BaseInterface {
    name: string;
    creditHours: number;
    amountRefunded: number;
    price: number;
    price2: number;
    tax: number;
    refunded: boolean;
    paidAmount: number;
    paid: boolean;
    quantity: number;
    amenityHoursIncluded: number;
    startDate: Date;
    endDate: Date;
    payDate: string;
    dateBought: Date;
    spaceId: number;
    venueId: number;
    createdById: number;
    updatedById: number;
    subscriptionId: number;
    reservationId: number;
    chargeType: ChargeType;
    invoiceId: number;
    createdBy: UserInterface;
    updatedBy: UserInterface;
    space: SpaceInterface;
    venue: VenueInterface;
    subscription: SubscriptionInterface;
    reservation: ReservationInterface;
    invoice: InvoiceInterface;
    invoiceItemType: InvoiceItemType;
}
