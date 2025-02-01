import BaseEntity from '@entity/base.entity';
import { Column, Entity } from 'typeorm';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

@Entity({ name: 'EmailVariable', schema: 'email' })
export default class EmailVariableEntity extends BaseEntity {
	@IsString()
	@IsNotEmpty()
	@Column()
	name: string;

	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	description: string;

	@IsInt()
	@IsOptional()
	@Column({ nullable: true })
	parentId: number;
}
