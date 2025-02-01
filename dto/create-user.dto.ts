import UserStatus from 'dd-common-blocks/dist/type/UserStatus';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { JSONSchema } from 'class-validator-jsonschema';
import { IsUsernameUnique } from '@utils/validator/unique-username.validator';
import CreateGroupCompanyDto from './create-group-company.dto';
import CreateInvoiceDto from './create-invoice.dto';
import { IsEmailUnique } from '@utils/validator/unique-email.validator';
import { IsPhoneUnique } from '@utils/validator/unique-phone.validator';
import UserEntity from '@entity/user.entity';

@JSONSchema({
	description: 'Create user DTO',
})
export default class CreateUserDto {
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
	teamId?: string | number;

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

	
	@IsInt()
	@IsOptional()
	@JSONSchema({
		description: 'User space ID',
		example: 312,
	})
	spaceId?: number;

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
	 * New company object
	 */
	@IsOptional()
	@Type(() => CreateGroupCompanyDto)
	@ValidateNested()
	company?: CreateGroupCompanyDto;

	/**
	 * User phone
	 */
	@IsInt()
	@IsNotEmpty()
	@IsPhoneUnique({ context: UserEntity })
	@JSONSchema({
		description: 'User phone',
		example: 3805000000,
	})
	phone: number;

	/**
	 * Username
	 */
	@IsString()
	@IsNotEmpty()
	@IsUsernameUnique()
	@JSONSchema({
		description: 'Username',
		example: 'awesome_237',
	})
	username: string;

	/**
	 * About user
	 */
	@IsOptional()
	@IsString()
	@JSONSchema({
		description: 'User info text',
		example:
			'Vivamus magna justo, lacinia eget consectetur sed, convallis at tellus. Mauris blandit aliquet elit, eget tincidunt nibh pulvinar a. Quisque velit nisi, pretium ut lacinia in, elementum id enim. Pellentesque in ipsum id orci porta dapibus. Proin eget tortor risus. Mauris blandit aliquet elit, eget tincidunt nibh pulvinar a. Donec rutrum congue leo eget malesuada. Vivamus suscipit tortor eget felis porttitor volutpat.',
	})
	about: string;

	/**
	 * Password
	 */
	@IsString()
	@IsNotEmpty()
	@JSONSchema({
		description: 'Password',
		example: '123456asdQ&e',
	})
	password: string;

	/**
	 * New user team name
	 */
	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'New user team name to create',
		example: 'My awesome team',
	})
	teamName?: string;

	/**
	 * User first name
	 */
	@IsString()
	@IsNotEmpty()
	@JSONSchema({
		description: 'User first name',
		example: 'John',
	})
	firstname: string;

	/**
	 * User last name
	 */
	@IsString()
	@IsNotEmpty()
	@JSONSchema({
		description: 'User last name',
		example: 'Smith',
	})
	lastname: string;

	/**
	 * User email
	 */
	@IsString()
	@IsNotEmpty()
	@IsEmailUnique({ context: UserEntity })
	@JSONSchema({
		description: 'User email',
		example: 'user@mail.com',
	})
	email: string;

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
	@Type(() => CreateInvoiceDto)
	@ValidateNested()
	@JSONSchema({
		description: 'User new subscriptions',
	})
	subscriptions?: CreateInvoiceDto[];

	@IsOptional()
	@ValidateNested()
	@IsEnum(UserStatus)
	@JSONSchema({
		description: 'User status',
		example: 'active',
		enum: Object.values(UserStatus),
	})
	status?: UserStatus;
}
