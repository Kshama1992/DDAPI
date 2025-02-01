import { Transform, Type } from "class-transformer";
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";

export default class UserFilterRequest {

    @IsString()
	@IsOptional()
    searchString?: string;

    @IsNumber()
	@IsOptional()
    limit?: number;

    @IsNumber()
	@IsOptional()
    offset?: number;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @Type(() => String)
    @Transform(({ value }) => Array.isArray(value) ? value : [value])
    selectOnly?: string[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @Type(() => String)
    @Transform(({ value }) => Array.isArray(value) ? value : [value])
    inludeIds?: string[];

    @IsString()
	@IsOptional()
    brandId?: string;

    @IsBoolean()
	@IsOptional()
    excludeSelf?: boolean;

    @IsBoolean()
	@IsOptional()
    isAdmin?: boolean;

    @IsString()
	@IsOptional()
    status?: string;

    @IsString()
	@IsOptional()
    roleId?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @Type(() => String)
    @Transform(({ value }) => Array.isArray(value) ? value : [value])
    createdAtRange?: string[];

    @IsString()
	@IsOptional()
    teamLeadId?: string;

    @IsString()
	@IsOptional()
    venueId?: string;

    @IsBoolean()
	@IsOptional()
    noTeamLead?: boolean;

    @IsBoolean()
	@IsOptional()
    withSubscriptions?: boolean;

    @IsBoolean()
	@IsOptional()
    withPhoto?: boolean;

    @IsBoolean()
	@IsOptional()
    withBrand?: boolean;

    @IsBoolean()
	@IsOptional()
    withCache?: boolean;

    @IsBoolean()
	@IsOptional()
    withRole?: boolean;

    @IsBoolean()
	@IsOptional()
    withCards?: boolean;

    @IsBoolean()
	@IsOptional()
    withInvoices?: boolean;

    @IsBoolean()
	@IsOptional()
    withTeams?: boolean;

    @IsBoolean()
	@IsOptional()
    withCompanies?: boolean;
}