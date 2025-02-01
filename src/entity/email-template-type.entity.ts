import BaseEntity from '@entity/base.entity';
import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import EmailVariableEntity from '@entity/email-variable.entity';
import { IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { IsNameUnique } from '@utils/validator/unique-name.validator';

export interface EmailTemplateVariable {
	name: string;
	description: string;
	parentId: number;
}

@Entity({ name: 'EmailTemplateType', schema: 'email' })
export default class EmailTemplateTypeEntity extends BaseEntity {
	@IsString()
	@IsNotEmpty()
	@IsNameUnique()
	@Column()
	name: string;

	@IsOptional()
	@ValidateNested()
	@ManyToMany(() => EmailVariableEntity, { cascade: true })
	@JoinTable({
		name: 'TemplateVar',
		joinColumn: {
			name: 'emailTemplateTypeId',
			referencedColumnName: 'id',
		},
		inverseJoinColumn: {
			name: 'emailVariableId',
			referencedColumnName: 'id',
		},
	})
	templateVariables: EmailVariableEntity[];
}
