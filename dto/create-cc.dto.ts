import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

@JSONSchema({
	description: 'Create credit card DTO',
})
export default class CreateCCDto {
	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'Address zip',
		example: '12345',
	})
	address_zip?: string;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'CVC code',
		example: '123',
	})
	cvc?: string;

	@IsString()
	@IsNotEmpty()
	@JSONSchema({
		description: 'Expiration month',
		example: '11',
	})
	exp_month: string;

	@IsString()
	@IsNotEmpty()
	@JSONSchema({
		description: 'Expiration year',
		example: '11',
	})
	exp_year: string;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'Cardholder name',
		example: 'John Smith',
	})
	name?: string;

	@IsString()
	@IsNotEmpty()
	@JSONSchema({
		description: 'CC Number',
		example: '4242424242424242',
	})
	number: string;
}
