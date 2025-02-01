import UserStatus from 'dd-common-blocks/dist/type/UserStatus';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Transform, Type } from 'class-transformer';

export default class UpdateUserDto {
	/**
	 * Brand ID
	 */
	@IsInt()
	@IsOptional()
	@JSONSchema({
		description: 'User brand ID',
		example: 3,
	})
	brandId?: number;

	/**
	 * Team ID
	 */
	@IsInt()
	@IsOptional()
	@JSONSchema({
		description: 'User team ID',
		example: 33,
	})
	teamId?: string;

	/**
	 * Created by user ID
	 */
	@IsInt()
	@IsOptional()
	@JSONSchema({
		description: 'User created by ID',
		example: 237,
	})
	createdById?: number;

	/**
	 * User role ID
	 */
	@IsInt()
	@IsOptional()
	@JSONSchema({
		description: 'User role ID',
		example: 312,
	})
	roleId?: number;

	/**
	 * User company ID
	 */
	@IsInt()
	@IsOptional()
	@JSONSchema({
		description: 'User company ID',
		example: 123,
	})
	companyId?: number;

	/**
	 * User phone
	 */
	@IsInt()
	@IsOptional()
	@JSONSchema({
		description: 'User phone',
		example: 3805000000,
	})
	phone?: number;

	/**
	 * Username
	 */
	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'Username',
		example: 'awesome_237',
	})
	username?: string;

	/**
	 * User first name
	 */
	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'User first name',
		example: 'John',
	})
	firstname?: string;

	/**
	 * User last name
	 */
	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'User last name',
		example: 'Smith',
	})
	lastname?: string;

	/**
	 * User email
	 */
	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'User email',
		example: 'user@mail.com',
	})
	email?: string;

	/**
	 *
	 */
	@IsString({ each: true })
	@IsOptional()
	@IsArray()
	@Type(() => String)
	@Transform(({ value }) => Array.isArray(value) ? value : [value])
	@JSONSchema({
		description: 'User images array base 64 converted. Will be used only first as avatar',
		example: '["data:image/png;base64, _______", "data:image/png;base64, _______"]',
	})
	uploadAttachments?: string[];

	/**
	 * Is user brand admin
	 */
	@IsBoolean()
	@IsOptional()
	@JSONSchema({
		description: 'Is user brand admin',
		example: false,
	})
	isAdmin?: boolean;

	@IsOptional()
	@IsEnum(UserStatus)
	@JSONSchema({
		description: 'User status',
		example: 'active',
		enum: Object.values(UserStatus),
	})
	status?: UserStatus;
}
