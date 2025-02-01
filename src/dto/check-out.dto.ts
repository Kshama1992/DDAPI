import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

@JSONSchema({
	description: 'Check out DTO',
})
export default class CheckOutDto {
	@IsString()
	@IsNotEmpty()
	@JSONSchema({
		description: 'Reservation ID',
		example: '123',
	})
	reservationId: number;

	@IsBoolean()
	@IsOptional()
	@JSONSchema({
		description: 'Is request from cron job',
		example: false,
	})
	isCron?: boolean;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'End time string',
	})
	endTime?: string;
}
