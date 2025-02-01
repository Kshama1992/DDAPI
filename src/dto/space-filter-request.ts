import { Transform, Type } from "class-transformer";
import { IsArray, IsNumber, IsOptional, IsString } from "class-validator";
import type PackageShow from "dd-common-blocks/dist/type/PackageShow";
import type VenueStatus from "dd-common-blocks/dist/type/VenueStatus";

export default class SpaceFilterRequest {

    searchString?: string;

    // Search Limit (pagination)
    limit?: number;

    // Search offset (pagination)
    offset?: number;

    venueId?: number;

    venueAlias?: string;

    alias?: string;

    spaceId?: number;

    brandId?: number;

    status?: string;

    venueStatus?: VenueStatus;

    @IsOptional()
    @IsArray()
    @IsNumber({}, { each: true })
    @Type(() => Number)
    @Transform(({ value }) => Array.isArray(value) ? value : [value])
    price?: number[];

    spaceAvailibilityDays?: string;

    @IsOptional()
    @IsArray()
    @IsNumber({}, { each: true })
    @Type(() => Number)
    @Transform(({ value }) => Array.isArray(value) ? value : [value])
    capacityValue?: number[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @Type(() => String)
    @Transform(({ value }) => Array.isArray(value) ? value : [value])
    amenities?: string[];

    spaceTypeId?: number;
    
    @IsOptional()
    @IsArray()
    @IsNumber({}, { each: true })
    @Type(() => Number)
    @Transform(({value}) => Array.isArray(value) ? value : [value])
    spaceTypeIds?: number[];

    brandCategoryId?: number;
    
    @IsOptional()
    @IsArray()
    @IsNumber({}, { each: true })
    @Type(() => Number)
    @Transform(({value}) => Array.isArray(value) ? value : [value])
    subCategoryIds?: number[];

    country?: string;

    capacity?: number;

    quantity?: number;

    radius?: number;

    radiusMiles?: number;

    radiusKm?: number;

    latitude?: string | number;

    longitude?: string | number;

    city?: string;

    state?: string;

    chargeType?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @Type(() => String)
    @Transform(({ value }) => Array.isArray(value) ? value : [value])
    chargeTypes?: string[];

    @IsOptional()
    @IsArray()
    @Transform(({ value }) => Array.isArray(value) ? value : [value])
    packageShow?: PackageShow[];

    @IsOptional()
    @IsArray()
    @IsNumber({}, { each: true })
    @Type(() => Number)
    @Transform(({value}) => Array.isArray(value) ? value : [value])
    excludeIds?: number[];

    address?: string;

    pageSize?: number;

    page?: number;

    withBrand?: boolean;

    withCreatedBy?: boolean;

    withUpdatedBy?: boolean;

    withVenue?: boolean;

    withSpaceType?: boolean;

    withPackageSpaceTypes?: boolean;

    withPackageVenueTypes?: boolean;

    withPackageVenues?: boolean;

    withPackageBrands?: boolean;

    withPhotos?: boolean;

    withAmenities?: boolean;

    withEventData?: boolean;

    withCreditHours?: boolean;

    withSpaceAccessCustomData?: boolean;

    withVenueAccessCustomData?: boolean;

    withReservations?: boolean;

    withSubscriptions?: boolean;

    withInvoices?: boolean;

    withCache?: boolean;
}