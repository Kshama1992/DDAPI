import BaseEntity from '@entity/base.entity';
import { Column, Entity, Index, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany } from 'typeorm';
import UserEntity from '@entity/user.entity';
import BrandEntity from '@entity/brand.entity';
import FileEntity from '@entity/file.entity';
import GroupMemberEntity from '@entity/group-member.entity';
import GroupInterface from '@interface/group.interface';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

@Entity({ name: 'Group', schema: 'group' })
export default class GroupEntity extends BaseEntity implements GroupInterface {
	@IsString()
	@IsNotEmpty()
	@Column()
	name: string;

	@IsString()
	@IsNotEmpty()
	@IsOptional()
	@Column({ nullable: true })
	address: string;

	@IsString()
	@IsOptional()
	@Column({ default: ' ' })
	description: string;

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'createdById' })
	createdBy: UserEntity;

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'updatedById' })
	updatedBy: UserEntity;

	@IsInt()
	@Index()
	@Column()
	brandId: number;

	@IsInt()
	@Index()
	@Column()
	createdById: number;

	@IsOptional()
	@IsInt()
	@Index()
	@Column({ nullable: true })
	updatedById: number;

	@ManyToOne(() => BrandEntity)
	@JoinColumn({ name: 'brandId' })
	brand: BrandEntity;

	@ManyToMany(() => FileEntity, { cascade: true })
	@JoinTable({
		name: 'GroupPhoto',
		joinColumn: {
			name: 'groupId',
			referencedColumnName: 'id',
		},
		inverseJoinColumn: {
			name: 'fileId',
			referencedColumnName: 'id',
		},
	})
	photos: FileEntity[];

	@OneToMany(() => GroupMemberEntity, (fc) => fc.group)
	members: GroupMemberEntity[];

	uploadAttachments: string[];

	_canDelete?(user: UserEntity | undefined): boolean {
		return this._canEdit!(user);
	}

	_canEdit?(user?: UserEntity | undefined) {
		if (!user) return false;
		if (user.isSuperAdmin()) return true;
		return user.id === this.createdById || (user.brandId === this.brandId && user.isAdmin);
	}
}
