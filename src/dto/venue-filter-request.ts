import { Transform, Type } from "class-transformer";
import { IsArray, IsBoolean, IsNumber, IsNumberString, IsOptional, IsString } from "class-validator";

export default class VenueFilterRequest {
    @IsString()
	@IsOptional()
    searchString?: string;

    @IsNumber()
	@IsOptional()
    limit?: number;

    @IsNumber()
	@IsOptional()
    offset?: number;

    @IsNumber()
	@IsOptional()
    venueId?: number;

    startDate?: Date;

    endDate?: Date;

    @IsString()
	@IsOptional()
    alias?: string;

    @IsOptional()
    @IsArray()
    @IsNumber({}, { each: true })
    @Type(() => Number)
    @Transform(({value}) => Array.isArray(value) ? value : [value])
    venueIds?: number[];

    @IsNumber()
	@IsOptional()
    brandId?: number;

    @IsOptional()
    @IsArray()
    @IsNumber({}, { each: true })
    @Type(() => Number)
    @Transform(({value}) => Array.isArray(value) ? value : [value])
    brandIds?: number[];

    @IsOptional()
    @IsArray()
    @IsNumber({}, { each: true })
    @Type(() => Number)
    @Transform(({value}) => Array.isArray(value) ? value : [value])
    venueTypeIds?: number[];

    @IsOptional()
    @IsBoolean()
    filterAdmin?: boolean;

    @IsString()
	@IsOptional()
    status?: string;

    @IsNumberString()
	@IsOptional()
    latitude?: string | number;

    @IsNumberString()
	@IsOptional()
    longitude?: string | number;

    @IsString()
	@IsOptional()
    city?: string;

    @IsString()
	@IsOptional()
    state?: string;

    @IsString()
	@IsOptional()
    country?: string;

    @IsString()
	@IsOptional()
    address?: string;

    @IsNumberString()
	@IsOptional()
    radius?: string | number;

    @IsBoolean()
	@IsOptional()
    withCreatedBy?: boolean;

    @IsBoolean()
	@IsOptional()
    withUpdatedBy?: boolean;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @Type(() => String)
    @Transform(({ value }) => Array.isArray(value) ? value : [value])
    createdAtRange?: string[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @Type(() => String)
    @Transform(({ value }) => Array.isArray(value) ? value : [value])
    packageCreatedAtRange?: string[];

    @IsBoolean()
	@IsOptional()
    isExport? : boolean
}