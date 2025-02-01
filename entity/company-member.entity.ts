import BaseEntity from '@entity/base.entity';
import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import UserEntity from '@entity/user.entity';
import CompanyEntity from '@entity/company.entity';
import ApprovalStatus from 'dd-common-blocks/dist/type/ApprovalStatus';
import DateWithTzTransformer from '@utils/transformer/date-with-tz';
import CompanyMemberInterface from '@interface/company-member.interface';

/**
 * Company member entity
 * @category Entities
 * @subcategory Company
 * @extends BaseEntity
 * @swagger
 * components:
 *   schemas:
 *     CompanyMemberEntity:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: The ID.
 *           example: 2
 *         companyId:
 *           type: integer
 *           description: The company ID.
 *           example: 3
 *         createdById:
 *           type: integer
 *           description: The created by user ID.
 *           example: 5
 *         userId:
 *           type: integer
 *           description: The company member ID.
 *           example: 5
 *         company:
 *           $ref: '#/components/schemas/CompanyEntity'
 *         member:
 *           $ref: '#/components/schemas/UserEntity'
 *         dateApproved:
 *           type: string
 *           description: Approved date by team lead.
 *           example: 2020-07-20 12:29:22
 *         createdBy:
 *           $ref: '#/components/schemas/UserEntity'
 *         status:
 *           $ref: '#/components/schemas/ApprovalStatus'
 */
@Entity({ name: 'CompanyMember', schema: 'company' })
export default class CompanyMemberEntity extends BaseEntity implements CompanyMemberInterface {
	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'createdById' })
	createdBy: UserEntity;

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'userId' })
	member: UserEntity;

	@ManyToOne(() => CompanyEntity)
	@JoinColumn({ name: 'companyId' })
	company: CompanyEntity;

	@Column()
	companyId: number;

	@Column()
	createdById: number;

	@Column()
	userId: number;

	@Column({ type: 'timestamp with time zone', transformer: new DateWithTzTransformer() })
	dateApproved: Date;

	@Column({
		type: 'enum',
		enum: ApprovalStatus,
	})
	status: ApprovalStatus;
}
