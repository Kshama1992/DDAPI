import { IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";

export default class SpacetypeFilterRequest {
    @IsString()
	@IsOptional()
    searchString?: string;

    @IsNumber()
	@IsOptional()
    limit?: number;

    @IsNumber()
	@IsOptional()
    offset?: number;

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

    @IsBoolean()
	@IsOptional()
    withContactType?: boolean;
}