import { JSONSchema } from 'class-validator-jsonschema';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import Stripe from 'stripe';

@JSONSchema({
	description: 'Stripe card response',
	example: {
		id: 'card_123456789',
		object: 'card',
		address_city: null,
		address_country: null,
		address_line1: null,
		address_line1_check: null,
		address_line2: null,
		address_state: null,
		address_zip: null,
		address_zip_check: null,
		brand: 'Visa',
		country: 'US',
		customer: 'cus_123456789',
		cvc_check: 'pass',
		dynamic_last4: null,
		exp_month: 2,
		exp_year: 2044,
		fingerprint: '123456789',
		funding: 'credit',
		last4: '4242',
		metadata: {},
		name: null,
		tokenization_method: null,
		isDefault: true,
	},
})

/**
 * Duplicated Stripe.Card class
 * @link https://stripe.com/docs/api/cards
 */
export default class StripeCardResp implements Stripe.Card {
	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'Unique identifier for the object.',
		example: 'card_123456789',
	})
	id: string;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: "String representing the object's type. Objects of the same type share the same value.",
		example: 'card',
	})
	object: 'card';

	@IsString()
	@IsNotEmpty()
	@JSONSchema({
		description: 'Address city',
		example: 'New York',
	})
	address_city: string | null;

	@IsString()
	@IsNotEmpty()
	@JSONSchema({
		description: 'Address country',
		example: 'USA',
	})
	address_country: string | null;

	@IsString()
	@IsNotEmpty()
	@JSONSchema({
		description: 'Address line 1',
		example: '123 Street',
	})
	address_line1: string | null;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'Address line 2 (Apartment/Suite/Unit/Building).',
		example: 'Apartment/Suite/Unit/Building',
	})
	address_line2: string | null;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'Address state',
		example: 'New York',
	})
	address_state: string | null;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'Address zip',
		example: '12345',
	})
	address_zip: string | null;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description:
			'Three-letter ISO code for currency . Only applicable on accounts (not customers or recipients). The card can be used as a transfer destination for funds in this currency.',
		example: 'usd',
	})
	currency?: string | null;

	address_line1_check: string | null;
	address_zip_check: string | null;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'Card brand. Can be American Express, Diners Club, Discover, JCB, MasterCard, UnionPay, Visa, or Unknown.',
		example: 'Visa',
	})
	brand: string;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description:
			"Two-letter ISO code representing the country of the card. You could use this attribute to get a sense of the international breakdown of cards you've collected.",
		example: 'US',
	})
	country: string | null;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description:
			'The customer that this card belongs to. This attribute will not be in the card object if the card belongs to an account or recipient instead.',
		example: 'cus_123456789',
	})
	customer?: string | null;

	cvc_check: string | null;
	dynamic_last4: string | null;
	exp_month: number;
	exp_year: number;
	fingerprint: string;
	funding: string;
	last4: string;
	metadata: any;
	name: string | null;
	tokenization_method: string | null;
	isDefault: boolean;

	constructor(props: Stripe.Card) {
		this.name = props.name;
		this.tokenization_method = props.tokenization_method;
		this.metadata = props.metadata;
		this.last4 = props.last4;
		this.funding = props.funding;
		this.exp_year = props.exp_year;
		this.exp_month = props.exp_month;
		this.dynamic_last4 = props.dynamic_last4;
		this.cvc_check = props.cvc_check;
		// @ts-ignore
		this.customer = props.customer;
		this.country = props.country;
		this.brand = props.brand;
		this.address_zip_check = props.address_zip_check;
		this.address_line1_check = props.address_line1_check;
		this.currency = props.currency;
		this.address_zip = props.address_zip;
		this.address_state = props.address_state;
		this.address_line2 = props.address_line2;
		this.address_line1 = props.address_line1;
		this.address_country = props.address_country;
		this.address_city = props.address_city;
		this.object = props.object;
		this.id = props.id;
	}
}
