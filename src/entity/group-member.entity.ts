import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import BaseEntity from '@entity/base.entity';
import UserEntity from '@entity/user.entity';
import ApprovalStatus from 'dd-common-blocks/dist/type/ApprovalStatus';
import GroupEntity from '@entity/group.entity';
import DateWithTzTransformer from '@utils/transformer/date-with-tz';
import GroupMemberInterface from "@interface/group-member.interface";

@Entity({ name: 'GroupMember', schema: 'group' })
export default class GroupMemberEntity extends BaseEntity implements GroupMemberInterface {
	@ManyToOne(() => UserEntity)
	@JoinColumn()
	createdBy: UserEntity;

	@Column({ type: 'timestamp with time zone', transformer: new DateWithTzTransformer() })
	dateApproved: Date;

	@Column({
		type: 'enum',
		enum: ApprovalStatus,
	})
	status: ApprovalStatus;

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'userId' })
	member: UserEntity;

	@ManyToOne(() => GroupEntity)
	@JoinColumn({ name: 'groupId' })
	group: GroupEntity;

	@Column()
	groupId: number;

	@Column()
	createdById: number;

	@Column()
	userId: number;
}
