import BaseEntity from '@entity/base.entity';
import { Column, Entity } from 'typeorm';

@Entity({ name: 'RefundType', schema: 'refund' })
export default class RefundTypeEntity extends BaseEntity {
	@Column()
	name: string;
}
