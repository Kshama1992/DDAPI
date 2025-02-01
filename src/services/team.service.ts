import { Brackets } from 'typeorm';
import TeamEntity from '@entity/team.entity';
import TeamFilter from 'dd-common-blocks/dist/interface/filter/team-filter.interface';
import BaseListFilterInterface from 'dd-common-blocks/dist/interface/filter/base-list-filter.interface';
import TeamCreateWebRequestInterface from 'dd-common-blocks/dist/interface/request/team-create-web-request.interface';
import UserEntity from '@entity/user.entity';
import SubscriptionEntity from '@entity/subscription.entity';
import { sendUserDefinedTemplate } from '@helpers/send-mail.helper';
import { AWS_URL, DOMAIN } from '../config';
import TeamMemberEntity from '@entity/team-member.entity';
import TeamMemberStatus from 'dd-common-blocks/dist/type/TeamMemberStatus';
import BaseService from '@services/base.service';
import { ForbiddenResponse } from '@utils/response/forbidden.response';
import loggerHelper from '@helpers/logger.helper';
import { Service } from 'typedi';
import MainDataSource from '@src/main-data-source';

/**
 * Handle all actions with Teams.
 * @module TeamService
 * @category Services
 */
@Service()
export default class TeamService extends BaseService {
	constructor() {
		super();
		this.entity = TeamEntity;
	}

	/**
	 * Get single team
	 * @param {number} id
	 * @returns {Promise<TeamEntity>}
	 */
	single(id: number): Promise<TeamEntity> {
        return MainDataSource.getRepository(TeamEntity).findOneOrFail({
            where: { id },
			select:{
				members: {
					createdAt: true,
					updatedAt : true,
					email:true,
					id: true,
					isTeamLead:true,
					memberId:true,
					status:true,
					teamId:true,
					createdById:true,
					updatedById:true
				},
			},
            relations: [
                'brand',
                'teamLead',
                'subscriptions',
                'companies',
                'members',
                'members.member',
				'members.member.photo',
                'subscriptions.creditsRotation',
                'subscriptions.creditHours',
                'subscriptions.spaceTypes',
                'subscriptions.brands',
                'subscriptions.venues',
                'subscriptions.teams',
                'subscriptions.venueTypes',
                'subscriptions.brand',
                'subscriptions.venue',
                'subscriptions.space',
            ],
        });
	}

	/**
	 * Get team list with filter
	 * @inheritDoc
	 * @param {TeamFilter} params
	 * @returns {Promise}
	 */
	async list(params: TeamFilter): Promise<[TeamEntity[], number]> {
		const { brandId, teamLeadId, includeIds, searchString, limit = 10, offset = 0 } = params;

		let q = MainDataSource.getRepository(TeamEntity)
			.createQueryBuilder('Team')
			.leftJoinAndSelect('Team.teamLead', 'teamLead')
			.leftJoinAndSelect('Team.brand', 'brand')
			.leftJoinAndSelect('Team.createdBy', 'createdBy')
			.leftJoinAndSelect('Team.members', 'members')
			.leftJoinAndSelect('members.member', 'membersUser')
			.leftJoinAndSelect('membersUser.photo', 'photo')
			.leftJoinAndSelect('Team.subscriptions', 'subscriptions')
			.andWhere(teamLeadId ? `Team.teamLeadId= :teamLeadId` : '1=1', { teamLeadId })
			.andWhere(brandId ? `Team.brandId= :brandId` : '1=1', { brandId })
			.andWhere(searchString ? `LOWER(Team.name) LIKE LOWER(:searchString)` : '1=1', { searchString: `%${searchString}%` })
			.take(limit)
			.skip(offset);

		if (includeIds) q = q.andWhereInIds(includeIds);

		return q.getManyAndCount();
	}

	/**
	 * Get team members list
	 * @inheritDoc
	 * @param {number} teamId
	 * @param {BaseListFilterInterface} params
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise}
	 */
	async listMembers(
		teamId: number,
		params: BaseListFilterInterface,
		requestedByUser: UserEntity | undefined
	): Promise<[TeamMemberEntity[], number]> {
		if (!teamId) throw new ForbiddenResponse({ message: 'Please select team' });

		await MainDataSource.getRepository(TeamEntity).findOneOrFail({ where: { id: teamId } });
		// if (!team._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		const { searchString } = params;

		let query = MainDataSource.getRepository(TeamMemberEntity)
			.createQueryBuilder('tm')
			.leftJoinAndSelect('tm.team', 't')
			.leftJoinAndSelect('t.teamLead', 'teamLead')
			.leftJoinAndSelect('tm.member', 'u')
			.leftJoinAndSelect('u.photo', 'photo')
			.leftJoinAndSelect('u.brand', 'brand')
			.where(teamId ? 't.id = :teamId' : '1=1', { teamId })

		if (searchString) {
			if (searchString.split(' ').length > 1) {
				query = query.andWhere(
					new Brackets((subQb) => {
						subQb
							.where(`LOWER(u.firstname) LIKE LOWER(:searchString)`, {
								searchString: `%${searchString.split(' ')[0]}%`,
							})
							.orWhere(`LOWER(u.lastname) LIKE LOWER(:searchString)`, {
								searchString: `%${searchString.split(' ')[1]}%`,
							});
					})
				);
			} else {
				query = query.andWhere(
					new Brackets((subQb) => {
						subQb
							.where(`LOWER(u.firstname) LIKE LOWER(:searchString)`)
							.orWhere(`LOWER(u.lastname) LIKE LOWER(:searchString)`)
							.orWhere(`LOWER(u.username) LIKE LOWER(:searchString)`)
							.orWhere(`LOWER(u.email) LIKE LOWER(:searchString)`)
							.orWhere(`LOWER(tm.email) LIKE LOWER(:searchString)`)
							.orWhere(`CAST(u.phone as VARCHAR) LIKE LOWER(:searchString)`);
					}),
					{ searchString: `%${searchString}%` }
				);
			}
		}

		query = query.take(500);

		return query.getManyAndCount();
	}

	/**
	 * Create single team
	 * @param {TeamCreateWebRequestInterface} data - HTTP request data
	 * @param {UserEntity} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<TeamEntity>}
	 */
	async create(data: TeamCreateWebRequestInterface, requestedByUser: UserEntity): Promise<TeamEntity> {
		const teamRepo = MainDataSource.getRepository(TeamEntity);
		const teamLeadUser = await MainDataSource.getRepository(UserEntity).findOneOrFail({ where: { id: +data.teamLeadId } });
		const newTeamObj = teamRepo.create(data);
		const team = await teamRepo.save(newTeamObj);
		const newTeamMember = MainDataSource.getRepository(TeamMemberEntity).create({
			team,
			member: teamLeadUser,
			email: teamLeadUser.email,
			status: TeamMemberStatus.MEMBER_ADDED,
			createdById: requestedByUser.id,
			isTeamLead: true,
		});
		await MainDataSource.getRepository(TeamMemberEntity).save(newTeamMember);
		return this.single(team.id);
	}

	/**
	 * Delete single team
	 * @param {number} id - Company ID
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<CompanyEntity>}
	 */
	async delete(id: number, requestedByUser: UserEntity | undefined): Promise<TeamEntity> {
		const membersRepo = MainDataSource.getRepository(TeamMemberEntity);
		const repo = MainDataSource.getRepository(TeamEntity);
		const item = await repo.findOneOrFail({ where: { id: +id }, relations: ['members'] });

		if (!item._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		await Promise.all(
			item.members!.map(async (tm) => {
				await membersRepo.remove(tm);
			})
		);

		await repo.remove(item);
		return item;
	}

	/**
	 * Add team subscription
	 * @param {string | number} teamId - Team ID
	 * @param {string | number} subscriptionId - Team subscription ID
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<TeamEntity>}
	 */
	async addSubscription(teamId: string | number, subscriptionId: string | number, requestedByUser: UserEntity | undefined): Promise<TeamEntity> {
		const team = await MainDataSource.getRepository(TeamEntity).findOneOrFail({ where: { id: +teamId }, relations: ['subscriptions'] });
		if (!team._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		const findSub = team.subscriptions?.find((s) => s.id === Number(subscriptionId));

		if (findSub) throw new ForbiddenResponse({ message: 'Already have this subscription' });

		const subscription = await MainDataSource.getRepository(SubscriptionEntity).findOneOrFail({ where: { id: +subscriptionId } });

		team.subscriptions = team.subscriptions ? [...team.subscriptions!, subscription] : [subscription];

		return await MainDataSource.getRepository(TeamEntity).save(team);
	}

	/**
	 * Delete team subscription
	 * @param {string} teamId - Team ID
	 * @param {string} subscriptionId - Subscription ID
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<TeamEntity>}
	 */
	async deleteSubscription(teamId: string, subscriptionId: string, requestedByUser: UserEntity | undefined): Promise<TeamEntity> {
		const team = await MainDataSource.getRepository(TeamEntity).findOneOrFail({ where: { id: +teamId }, relations: ['subscriptions'] });
		if (!team._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		if (team.subscriptions) team.subscriptions = team.subscriptions.filter((s) => s.id !== Number(subscriptionId));
		return await MainDataSource.getRepository(TeamEntity).save(team);
	}

	/**
	 * Add team member
	 * @param teamId
	 * @param memberId
	 * @param status
	 * @param email !! ONLY from invite
	 * @param createdById
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async addMember(
		{
			teamId,
			memberId,
			status = TeamMemberStatus.MEMBER_ADDED,
			email = '',
			createdById,
		}: {
			teamId: number;
			memberId?: string | undefined | number;
			email?: string | undefined;
			status?: TeamMemberStatus;
			createdById?: string | number | undefined;
		},
		requestedByUser: UserEntity | undefined
	): Promise<TeamEntity | undefined> {
		const repo = MainDataSource.getRepository(TeamEntity);
		const userRepo = MainDataSource.getRepository(UserEntity);
		const team: TeamEntity = await repo.findOneOrFail({ where: { id: teamId }, relations: ['members', 'teamLead'] });

		if (!requestedByUser) throw new ForbiddenResponse();

		const exist = team.members?.find((m: TeamMemberEntity) => (memberId ? m.memberId === Number(memberId) : m.email === email));

		// member in team but could be deleted
		if (exist) {
			if (exist.status !== TeamMemberStatus.MEMBER_REMOVED) throw new ForbiddenResponse({ message: 'Already member' });
			// readding member
			await MainDataSource.getRepository(TeamMemberEntity).save({
				...exist,
				status: TeamMemberStatus.MEMBER_ADDED,
				updatedById: requestedByUser.id,
			});
			await this._sendEmailToMember(team, exist.email, 'add');
			return this.single(teamId);
		}

		const inviteSent = team.members?.find((m: TeamMemberEntity) => m.email === email && !m.memberId);

		// user already invited by email
		if (memberId && email && email.length && inviteSent) {
			await MainDataSource.getRepository(TeamMemberEntity).save({
				...inviteSent,
				memberId: Number(memberId),
				status: status || TeamMemberStatus.MEMBER_ADDED,
				updatedById: requestedByUser.id,
			});
			await this._sendEmailToMember(team, email, 'add');
			return this.single(teamId);
		}

		const obj: Partial<TeamMemberEntity> = { team, createdById: createdById ? Number(createdById) : Number(memberId), status };
		if (memberId) {
			const newMember: UserEntity = await userRepo.findOneOrFail({ where: { id: +memberId } });
			obj.memberId = Number(memberId);
			obj.email = newMember.email;
		}
		if (email && email.length) {
			obj.email = email;
			if (!memberId) obj.status = TeamMemberStatus.INVITE_SENT;
		}
		await MainDataSource.getRepository(TeamMemberEntity).save(
			MainDataSource.getRepository(TeamMemberEntity).create({ ...obj, updatedById: requestedByUser.id })
		);
		await this._sendEmailToMember(team, email, 'add');
		return this.single(teamId);
	}

	/**
	 * Delete team member
	 * @param {string} teamId - Team ID
	 * @param {string} memberId - Team member user ID
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<TeamEntity>}
	 */
	async deleteMember(teamId: number, memberId: number, requestedByUser: UserEntity | undefined): Promise<TeamMemberEntity> {
		const team = await MainDataSource.getRepository(TeamEntity).findOneOrFail({ where: { id: teamId }, relations: ['teamLead'] });
		if (!team._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		const repo = MainDataSource.getRepository(TeamMemberEntity);
		const teamMembership = await repo.findOneOrFail({ where: { teamId: +teamId, memberId: memberId } });
		const savedTeam = await repo.save({ ...teamMembership, status: TeamMemberStatus.MEMBER_REMOVED, updatedById: requestedByUser?.id });
		await this._sendEmailToMember(team, teamMembership.email, 'delete');
		return savedTeam;
	}

	/**
	 * Send invite mail to users
	 * @param {string} brandId - Brand ID
	 * @param {string} teamId - Team ID
	 * @param {string} userId - User ID
	 * @param {string[]} emails - Array of emails
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<void>}
	 */
	async invite(
		{ brandId, emails, teamId, userId }: { brandId: string; emails: string[]; teamId: number; userId: number },
		requestedByUser: UserEntity | undefined
	): Promise<void> {
		let teamName = '';
		let teamLeadName = '';

		const team = await MainDataSource.getRepository(TeamEntity).findOneOrFail({ where: { id: teamId }, relations: ['teamLead'] });

		if (!team._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		teamName = team.name;
		teamLeadName = team.teamLead ? `${team.teamLead!.firstname} ${team.teamLead!.lastname}` : '';

		await Promise.all(
			emails.map(async (email) => {
				try {
					await this.addMember(
						{ teamId, email, status: TeamMemberStatus.INVITE_SENT, createdById: requestedByUser?.id || team.teamLeadId },
						requestedByUser
					);
				} catch (e) {
					console.error('member already invited!');
				} finally {
					const msgData = {
						brandId: Number(brandId),
						teamId,
						team: {
							teamName,
							teamLeadName,
						},
						email,
						emailTo: email,
						url: `https://${DOMAIN}/sign?teamId=${teamId}`,
					};
					console.log('calling sendEmail from sendUserdefinedTemplate team.service.ts line 385');
					await sendUserDefinedTemplate(teamId ? 'Invite users from team lead' : 'Invite members', msgData);
				}
			})
		);
	}

	/**
	 * Delete team member
	 * @param {number} membershipId - Team membership ID
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<TeamMemberEntity>}
	 */
	async deleteInvite(membershipId: number, requestedByUser: UserEntity | undefined): Promise<TeamMemberEntity> {
		const repo = MainDataSource.getRepository(TeamMemberEntity);
		const invite = await repo.findOneOrFail({ where: { id: membershipId } });
		return repo.remove(invite);
	}

	/**
	 * Send email to member or team lead when delete/add membership
	 * @param {TeamEntity} team - Team object
	 * @param {string} email - Changed team member string
	 * @param {'add' | 'delete'} type - Type of member action
	 */
	async _sendEmailToMember(team: TeamEntity, email: string, type: 'add' | 'delete' = 'add') {
		try {
			const getNameString = (user: UserEntity): string => {
				if (user.isSuperAdmin()) return 'Super Admin';
				return `${user.firstname} ${user.lastname}`;
			};

			const teamMember = await MainDataSource.getRepository(TeamMemberEntity).findOneOrFail({
				where: { email, teamId: team.id },
				relations: ['member', 'createdBy', 'updatedBy'],
			});

			const user = teamMember.member;

			const messageData: any = {
				team: {
					teamLeadName: getNameString(team.teamLead!),
					teamName: team.name,
					changedBy: getNameString(teamMember.updatedBy || teamMember.createdBy!),
				},
				user: {
					firstName: user ? user.firstname : teamMember.email,
					lastName: user ? user.lastname : teamMember.email,
					username: user ? user.username : teamMember.email,
					fullname: user ? getNameString(user) : teamMember.email,
					email: teamMember.email,
					photo: user?.photo ? `${AWS_URL}/434x176${user.photo.url}` : `https://${DOMAIN}/images/header/default-avatar.png`,
					phone: user?.phone || '',
				},
				emailTo: email,
				brandId: teamMember.member?.brandId,
			};

			let userTemplateTypeName = `Team member ${type === 'add' ? 'added' : 'deleted'} to team member`;
			let adminTemplateTypeName = `Team member ${type === 'add' ? 'added' : 'deleted'} to team lead`;
			console.log('calling sendEmail from sendUserdefinedTemplate team.service.ts line 447,446');
			await sendUserDefinedTemplate(adminTemplateTypeName, { ...messageData, emailTo: team.teamLead?.email });
			await sendUserDefinedTemplate(userTemplateTypeName, messageData);
		} catch (e) {
			loggerHelper.error('SEND EMAIL ERROR - ', e);
			return;
		}
	}
}
