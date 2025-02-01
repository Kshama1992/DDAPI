import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

@JSONSchema({
	description: 'Edit credit card DTO',
})
export default class EditCcDto {
	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'Address zip',
		example: '12345',
	})
	address_zip?: string;

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
}
