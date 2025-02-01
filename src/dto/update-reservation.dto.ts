import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import ReservationStatus from 'dd-common-blocks/dist/type/ReservationStatus';

@JSONSchema({
	description: 'Update reservation DTO',
})
export default class UpdateReservationDto {
	@IsOptional()
	@IsEnum(ReservationStatus)
	@JSONSchema({
		description: 'Reservation status',
		example: 'active',
		enum: Object.values(ReservationStatus),
	})
	status?: ReservationStatus;

	/**
	 * User time zone name (e.g. America/New_York)
	 */
	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'User time zone name',
		example: 'America/New_York',
	})
	tzUser: string;

	/**
	 * Venue timezone
	 * @type {string}
	 */
	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'User time zone name',
		example: 'America/New_York',
	})
	tzLocation?: string;

	/**
	 * Reservation start time
	 * @type {Date}
	 */
	@IsString()
	@IsOptional()
	hoursFrom?: string;

	/**
	 * Reservation end time
	 * @type {Date}
	 */
	@IsString()
	@IsOptional()
	hoursTo?: string;

	@IsNumber()
	@IsOptional()
	updatedById?: number;
}
