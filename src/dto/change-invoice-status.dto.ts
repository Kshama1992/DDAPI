import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

@JSONSchema({
	description: 'Change invoice status DTO',
})
export default class ChangeInvoiceStatusDto {
	@IsNumber()
	@IsNotEmpty()
	@JSONSchema({
		description: 'New invoice status id',
		example: 12,
	})
	statusId: number;

	@IsNumber()
	@IsOptional()
	@JSONSchema({
		description: 'Security deposit status id',
		example: 12,
	})
	securityDepositStatusId?: number;

	@IsNumber()
	@IsOptional()
	@JSONSchema({
		description: 'payment mode id',
		example: 12,
	})
	paymentModeId?: number;

	@IsBoolean()
	@IsOptional()
	@JSONSchema({
		description: 'This is for security refund',
		example: 12,
	})
	isSecurityRefund?: boolean;

	@IsNumber()
	@IsOptional()
	@JSONSchema({
		description: 'Refund amount',
		example: 99,
	})
	refundAmount?: number;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'Refund note',
		example: 'Invoice #12345 refund',
	})
	refundNote?: string;
}
