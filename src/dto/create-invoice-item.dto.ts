import ChargeType from 'dd-common-blocks/dist/type/ChargeType';
import InvoiceItemType from 'dd-common-blocks/dist/type/InvoiceItemType';

export default class CreateInvoiceItemDto {
	name: string;
	chargeType: ChargeType;
	quantity: number;
	price: number;
	tax: number;
	invoiceItemType: InvoiceItemType;
}
