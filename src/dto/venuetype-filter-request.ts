import { IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";

export default class VenueTypeFilterRequest {

    @IsString()
	@IsOptional()
    alias?: string;

    @IsNumber()
	@IsOptional()
    brandId?: number;

    @IsBoolean()
	@IsOptional()
    withCache?: boolean;

    @IsBoolean()
	@IsOptional()
    withParent?: boolean;

    @IsBoolean()
	@IsOptional()
    withChildren?: boolean;

    @IsBoolean()
	@IsOptional()
    onlyChildren?: boolean;

    @IsNumber()
	@IsOptional()
    limit?: number;

    @IsNumber()
	@IsOptional()
    offset?: number;
}