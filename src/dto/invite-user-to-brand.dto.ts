import { Transform, Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

@JSONSchema({
	description: 'Invite user to brand DTO',
})
export default class InviteUserToBrandDto {
	@IsString()
	@IsNotEmpty()
	@JSONSchema({
		description: 'Brand ID',
		example: '123',
	})
	brandId: string;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'Team ID',
		example: '334',
	})
	teamId: string;

	@IsString({ each: true })
	@IsNotEmpty()
	@IsArray()
	@Type(() => String)
	@Transform(({ value }) => Array.isArray(value) ? value : [value])
	@JSONSchema({
		description: 'Team ID',
		example: ['user1@mail.com', 'user2@mail.com'],
	})
	emails: string[];
}
