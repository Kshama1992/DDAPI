import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

@JSONSchema({
	description: 'Create group or company DTO',
})
export default class CreateGroupCompanyDto {
	/**
	 * Company/Group name
	 */
	@IsString()
	@IsNotEmpty()
	@JSONSchema({
		description: 'Company/Group name',
		example: 'My new company',
	})
	name: string;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'Company/Group description',
		example: 'My new company description',
	})
	description?: string;

	/**
	 * Company/Group member IDs
	 */
	@IsString({ each: true })
	@IsOptional()
	@IsArray()
	@JSONSchema({
		description: 'Company/Group members IDs',
		example: '[2,3,4,5]',
	})
	members?: string[];

	/**
	 * Company/Group images base 64 converted
	 */
	@IsString({ each: true })
	@IsOptional()
	@IsArray()
	@JSONSchema({
		description: 'Company/Group images array base 64 converted',
		example: '["data:image/png;base64, _______", "data:image/png;base64, _______"]',
	})
	uploadAttachments?: string[];

	/**
	 * Company/Group main image
	 */
	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'Company/Group main image base 64',
		example: 'data:image/png;base64, _______',
	})
	image?: string;

	/**
	 * Company/Group owner user ID
	 */
	@IsInt()
	@IsOptional()
	@JSONSchema({
		description: 'Company/Group owner user ID',
		example: '234',
	})
	userId?: number;

	/**
	 * Company/Group brand ID
	 */
	@IsInt()
	@IsNotEmpty()
	@JSONSchema({
		description: 'Company/Group brand ID',
		example: '123',
	})
	brandId: number;

	/**
	 * Company/Group created by user ID
	 */
	@IsInt()
	@IsOptional()
	@JSONSchema({
		description: 'Company/Group created by user ID',
		example: '432',
	})
	createdById?: number;
}
