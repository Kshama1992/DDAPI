import { IsNotEmpty, IsString } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

@JSONSchema({
	description: 'Change password DTO',
})
export default class ChangePasswordDto {
	/**
	 * New password
	 */
	@IsString()
	@IsNotEmpty()
	@JSONSchema({
		description: 'New password',
		example: '123456asdQ&e',
	})
	newPass: string;
}
