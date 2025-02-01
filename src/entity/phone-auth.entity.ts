import BaseEntity from '@src/entity/base.entity';
import { Column, Entity } from 'typeorm';

@Entity({ name: 'PhoneAuth', schema: 'public' })
export default class PhoneAuthEntity extends BaseEntity {
	@Column()
	phone: number;

	@Column()
	code: string;

	@Column({ default: false })
	verified: boolean;

	@Column({ type: 'timestamptz' })
	verifiedAt?: Date;
}
