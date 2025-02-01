import { IsNumber, IsOptional, IsString } from "class-validator";

export default class AmenityFilterRequest {

    @IsString()
	@IsOptional()
    sort?: string; //need to be an enum

    @IsNumber()
    @IsOptional()
    limit: number = 10;
}