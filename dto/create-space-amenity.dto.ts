import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import ChargeType from 'dd-common-blocks/dist/type/ChargeType';

export default class CreateSpaceAmenityDto {
	/**
	 * Amenity ID
	 */
	@IsInt()
	@IsNotEmpty()
	amenityId: number;

	/**
	 * Space ID
	 */
	@IsInt()
	@IsNotEmpty()
	spaceId: number;

	@IsString()
	@IsOptional()
	name?: string;

	@IsString()
	@IsOptional()
	description?: string;

	@IsNumber()
	@IsOptional()
	price?: number;

	@IsNumber()
	@IsOptional()
	salesTax?: number;

	@IsEnum(ChargeType)
	@IsOptional()
	chargeType?: ChargeType;
}
