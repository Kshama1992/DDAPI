import { IsArray, ValidateNested } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Type } from 'class-transformer';
import CreateUserDto from '@src/dto/create-user.dto';

@JSONSchema({
	description: 'Import users DTO',
})
export default class ImportUsersDto {
	@IsArray()
	@Type(() => CreateUserDto)
	@ValidateNested({ each: true })
	@JSONSchema({
		description: 'Create User DTO',
	})
	users: CreateUserDto[];
}
