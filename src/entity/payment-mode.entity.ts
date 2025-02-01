import BaseEntity from '@entity/base.entity';
import { Column, Entity } from 'typeorm';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsNameUnique } from '@utils/validator/unique-name.validator';

@Entity({ name: 'PaymentMode', schema: 'invoice' })
export default class PaymentModeEntity extends BaseEntity {
	@IsString()
	@IsNotEmpty()
	@IsNameUnique()
	@Column()
	name: string;
}
