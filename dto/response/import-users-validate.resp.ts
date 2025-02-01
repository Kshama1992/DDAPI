import { IsBoolean } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

@JSONSchema({
	description: 'User import validate response',
})
export default class ImportUsersValidateResp {
	@IsBoolean()
	@JSONSchema({
		description: 'isValidUsername',
		example: true,
	})
	isValidUsername: boolean;

	@IsBoolean()
	@JSONSchema({
		description: 'isValidPhone number',
		example: true,
	})
	isValidPhone: boolean;

	@IsBoolean()
	@JSONSchema({
		description: 'isValidEmail',
		example: true,
	})
	isValidEmail: boolean;

	constructor(props: { isValidUsername: boolean; isValidPhone: boolean; isValidEmail: boolean }) {
		this.isValidPhone = props.isValidPhone;
		this.isValidUsername = props.isValidUsername;
		this.isValidEmail = props.isValidEmail;
	}
}
