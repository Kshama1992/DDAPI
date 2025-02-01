import { IsInt, IsNotEmpty, IsString } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

@JSONSchema({
	description: 'User import validate DTO',
})
export default class ImportUsersValidateDto {
	@IsString()
	@IsNotEmpty()
	@JSONSchema({
		description: 'Username',
		example: 'awesome_237',
	})
	username: string;

	@IsInt()
	@IsNotEmpty()
	@JSONSchema({
		description: 'User phone',
		example: 3805000000,
	})
	phone: number;

	@IsString()
	@IsNotEmpty()
	@JSONSchema({
		description: 'User email',
		example: 'user@mail.com',
	})
	email: string;
}
