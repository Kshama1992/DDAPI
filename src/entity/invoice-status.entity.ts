import BaseEntity from '@entity/base.entity';
import { Column, Entity } from 'typeorm';
import UserEntity from '@entity/user.entity';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsNameUnique } from '@utils/validator/unique-name.validator';

@Entity({ name: 'InvoiceStatus', schema: 'invoice' })
export default class InvoiceStatusEntity extends BaseEntity {
	@IsString()
	@IsNotEmpty()
	@IsNameUnique()
	@Column()
	name: string;

	_canCreate(user?: UserEntity | undefined): boolean {
		return this._canEdit(user);
	}

	_canEdit(user?: UserEntity | undefined): boolean {
		if (!user) return false;
		return user.isSuperAdmin();
	}
}
