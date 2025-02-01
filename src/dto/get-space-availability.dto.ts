import { JSONSchema } from 'class-validator-jsonschema';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

@JSONSchema({
	description: 'Edit credit card DTO',
})
export default class GetSpaceAvailabilityDto {
	@IsString()
	@IsNotEmpty()
	@JSONSchema({
		description: 'User ID',
		example: '12',
	})
	userId: string;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'Start date',
		example: '2021-11-09',
	})
	startDate?: string;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'End date',
		example: '2022-11-09',
	})
	endDate?: string;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'Reservation id to exclude from reserved items',
		example: '22',
	})
	excludeReservationId?: string;

	/**
	 * @deprecated
	 */
	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'User timezone ID',
		example: 'America/New_York',
	})
	userTZ?: string;
}
