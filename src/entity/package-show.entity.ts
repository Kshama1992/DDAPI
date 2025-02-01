import BaseEntity from '@entity/base.entity';
import { Column, Entity } from 'typeorm';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsNameUnique } from '@utils/validator/unique-name.validator';

@Entity({ name: 'PackageShow', schema: 'public' })
export default class PackageShowEntity extends BaseEntity {
	@IsString()
	@IsNotEmpty()
	@IsNameUnique()
	@Column()
	@Column()
	name: string;
}
