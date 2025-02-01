import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Transform, Type } from 'class-transformer';
import UserFilterInterface from 'dd-common-blocks/dist/interface/filter/user-filter.interface';

@JSONSchema({
	description: 'Query User list DTO',
})
export default class QueryUserDto implements UserFilterInterface {
	@IsString({ each: true })
	@IsArray()
	@IsOptional()
	@Type(() => String)
	@Transform(({ value }) => Array.isArray(value) ? value : [value])
	@JSONSchema({
		description: 'Select only fields',
		example: ['subscriptions', 'photo'],
	})
	selectOnly?: string[];

	@IsString({ each: true })
	@IsArray()
	@IsOptional()
	@Type(() => String)
	@Transform(({ value }) => Array.isArray(value) ? value : [value])
	@JSONSchema({
		description: 'Include IDs',
		example: ['10', '235'],
	})
	inludeIds?: string[];

	@IsString({ each: true })
	@IsArray()
	@IsOptional()
	@Type(() => String)
	@Transform(({ value }) => Array.isArray(value) ? value : [value])
	@JSONSchema({
		title: 'User created at range',
		description: 'User created at range',
		example: ['1979-01-01', '2022-01-01'],
	})
	createdAtRange?: string[];

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'Brand ID',
		example: '213',
	})
	brandId?: string;

	@IsBoolean()
	@IsOptional()
	@JSONSchema({
		description: 'Exclude self',
		example: false,
	})
	excludeSelf?: boolean;

	@IsBoolean()
	@IsOptional()
	@JSONSchema({
		description: 'Only admins',
		example: false,
	})
	isAdmin?: boolean;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'User status',
		example: 'active',
	})
	status?: string;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'User Role ID',
		example: '312',
	})
	roleId?: string;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'User Team lead ID',
		example: '523',
	})
	teamLeadId?: string;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'User venue ID',
		example: '43',
	})
	venueId?: string;

	@IsBoolean()
	@IsOptional()
	@JSONSchema({
		description: 'Include subscriptions to response',
		example: false,
	})
	withSubscriptions?: boolean;

	@IsBoolean()
	@IsOptional()
	@JSONSchema({
		description: 'Include photo to response',
		example: false,
	})
	withPhoto?: boolean;

	@IsBoolean()
	@IsOptional()
	@JSONSchema({
		description: 'Include brand to response',
		example: false,
	})
	withBrand?: boolean;

	@IsBoolean()
	@IsOptional()
	@JSONSchema({
		description: 'Include role to response',
		example: false,
	})
	withRole?: boolean;

	@IsBoolean()
	@IsOptional()
	@JSONSchema({
		description: 'Include credit cards to response',
		example: false,
	})
	withCards?: boolean;

	@IsBoolean()
	@IsOptional()
	@JSONSchema({
		description: 'Include invoices to response',
		example: false,
	})
	withInvoices?: boolean;

	@IsBoolean()
	@IsOptional()
	@JSONSchema({
		description: 'Include teams to response',
		example: false,
	})
	withTeams?: boolean;

	@IsBoolean()
	@IsOptional()
	@JSONSchema({
		description: 'Include companies to response',
		example: false,
	})
	withCompanies?: boolean;
}
