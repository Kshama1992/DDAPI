import { Transform, Type } from "class-transformer";
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import InvoiceFilter from 'dd-common-blocks/dist/interface/filter/invoice-filter.interface';

@JSONSchema({
	description: 'Query Invoice list DTO',
})
export default class QueryInvoiceDto implements InvoiceFilter {
	@IsString({ each: true })
	@IsArray()
	@IsOptional()
	@Type(() => String)
	@Transform(({ value }) => Array.isArray(value) ? value : [value])
	@JSONSchema({
		description: 'Invoice venue ids',
		example: [234, 164],
	})
	venueIds?: string[];

	@IsString({ each: true })
	@IsArray()
	@IsOptional()
	@Type(() => String)
	@Transform(({ value }) => Array.isArray(value) ? value : [value])
	@JSONSchema({
		description: 'Invoice space ids',
		example: [234, 164],
	})
	spaceIds?: string[];

	@IsString({ each: true })
	@IsArray()
	@IsOptional()
	@Type(() => String)
	@Transform(({ value }) => Array.isArray(value) ? value : [value])
	@JSONSchema({
		description: 'Invoice space type ids',
		example: [32, 43],
	})
	spaceTypeIds?: string[];

	@IsString({ each: true })
	@IsArray()
	@IsOptional()
	@Type(() => String)
	@Transform(({ value }) => Array.isArray(value) ? value : [value])
	@JSONSchema({
		description: 'Invoice status ids',
		example: [32, 43],
	})
	invoiceStatusIds?: string[];

	@IsString({ each: true })
	@IsArray()
	@IsOptional()
	@Type(() => String)
	@Transform(({ value }) => Array.isArray(value) ? value : [value])
	@JSONSchema({
		description: 'Invoice status ids',
		example: [32, 43],
	})
	securityDepositStatusIds?: string[];
	
	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'User ID',
		example: 231,
	})
	userId?: string;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'Venue ID',
		example: 313,
	})
	venueId?: string;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'Space ID',
		example: 431,
	})
	spaceId?: string;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'Space type ID',
		example: 431,
	})
	spaceTypeId?: string;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'Brand ID',
		example: 23,
	})
	brandId?: string;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'Team ID',
		example: 23,
	})
	teamId?: string;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'Query items limit',
		example: 10,
	})
	limit?: string;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'Query items offset',
		example: 10,
	})
	offset?: string;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'Invoice process date',
		example: ['2020-10-10'],
	})
	processDate?: string;

	@IsBoolean()
	@IsOptional()
	@JSONSchema({
		description: 'Sort by reservations',
		example: false,
	})
	sortByReservations?: boolean;

	@IsBoolean()
	@IsOptional()
	@JSONSchema({
		description: 'Filter for security deposit',
		example: false,
	})
	isSecuritydeposit?: boolean;
	dateFrom? : string;
	dateTo? : string;
}
