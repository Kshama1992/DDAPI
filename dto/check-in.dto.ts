import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

@JSONSchema({
	description: 'Create check-in DTO',
})
export default class CheckInDto {
	@IsString()
	@IsNotEmpty()
	@JSONSchema({
		description: 'Space ID',
		example: '123',
	})
	spaceId: string;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'User ID',
		example: '321',
	})
	userId: string;

	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'Created by User ID',
		example: '321',
	})
	createdById?: string;

	@IsString()
	@IsNotEmpty()
	@JSONSchema({
		description: 'User timezone ID',
		example: 'America/New_York',
	})
	userTz?: string;
}
