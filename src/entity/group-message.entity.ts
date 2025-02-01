import { Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne } from "typeorm";
import BaseEntity from '@entity/base.entity';
import UserEntity from '@entity/user.entity';
import GroupEntity from '@entity/group.entity';
import FileEntity from '@entity/file.entity';

@Entity({ name: 'GroupMessage', schema: 'group' })
export default class GroupMessageEntity extends BaseEntity {
	@Column()
	name: string;

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'createdById' })
	createdBy: UserEntity;

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'updatedById' })
	updatedBy: UserEntity;

	@Column()
	message: string;

	@Column()
	groupId: number;

	@ManyToOne(() => GroupEntity)
	@JoinColumn({ name: 'groupId' })
	group: GroupEntity;

	@ManyToMany(() => FileEntity)
	@JoinTable({
		name: 'GroupMessageAttachment',
		joinColumn: {
			name: 'groupMessageId',
			referencedColumnName: 'id',
		},
		inverseJoinColumn: {
			name: 'fileId',
			referencedColumnName: 'id',
		},
	})
	attachments: FileEntity[];
}
