import BaseEntity from '@entity/base.entity';
import { Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne } from "typeorm";
import UserEntity from '@entity/user.entity';
import FileEntity from '@entity/file.entity';

@Entity({ name: 'Message', schema: 'message' })
export default class MessageEntity extends BaseEntity {
	@Column()
	name: string;

	@Column()
	message: string;

	@Column()
	userId: number;

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'createdById' })
	createdBy: UserEntity;

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'updatedById' })
	updatedBy: UserEntity;

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'userId' })
	user: UserEntity;

	@ManyToMany(() => FileEntity)
	@JoinTable({
		name: 'MessageAttachment',
		joinColumn: {
			name: 'messageId',
			referencedColumnName: 'id',
		},
		inverseJoinColumn: {
			name: 'fileId',
			referencedColumnName: 'id',
		},
	})
	photos: FileEntity[];

	@ManyToMany(() => UserEntity)
	@JoinTable({
		name: 'MessageReadBy',
		joinColumn: {
			name: 'messageId',
			referencedColumnName: 'id',
		},
		inverseJoinColumn: {
			name: 'userId',
			referencedColumnName: 'id',
		},
	})
	readBy: UserEntity[];
}
