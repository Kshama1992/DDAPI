import { Transform, Type } from "class-transformer";
import { IsArray, IsNumber, IsOptional } from "class-validator";

export default class BrandFilterRequest {

    domain?: string;

    searchString?: string;

    limit?: number;

    offset?: number;

    @IsOptional()
    @IsArray()
    @IsNumber({}, { each: true })
    @Type(() => Number)
    @Transform(({value}) => Array.isArray(value) ? value : [value])
    includeIds?: number[];

    name?: string;
}