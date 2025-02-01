import { Authorized, CurrentUser, JsonController, Param, Body, Post, Delete, Get, QueryParams } from 'routing-controllers';
import AbstractControllerTemplate from '@utils/abstract.controller.template';
import { Inject, Service } from 'typedi';
import UserEntity from '@entity/user.entity';
import { SuccessResponse } from '@utils/response/success.response';
import { OpenAPI, ResponseSchema } from '@utils/openapi';
import TeamService from '@services/team.service';
import TeamEntity from '@entity/team.entity';
import TeamMemberEntity from '@entity/team-member.entity';

@Service()
@JsonController('/team/')
export class TeamController extends AbstractControllerTemplate {
	@Inject()
	service: TeamService;

	@Authorized()
	@Get(':id')
	@ResponseSchema(TeamEntity, {
		contentType: 'application/json',
		description: 'Single team object',
		statusCode: '201',
	})
	@OpenAPI({
		description: `Get single record`,
		security: [
			{
				bearerAuth: [],
			},
		],
	})
	public async single(@Param('id') id: number, @CurrentUser() user?: UserEntity) {
		return super.single(id, user);
	}

	@Get()
	@ResponseSchema(TeamEntity, {
		contentType: 'application/json',
		description: 'A list of teams',
		isArray: true,
		statusCode: '201',
	})
	@OpenAPI({
		description: `Get records list`,
		security: [
			{
				bearerAuth: [],
			},
		],
	})
	public async list(@QueryParams() query: any, @CurrentUser() user?: UserEntity) {
		return super.list(query, user);
	}

	@Get(':teamId/member')
	@ResponseSchema(TeamMemberEntity, {
		contentType: 'application/json',
		description: 'A list of team members',
		isArray: true,
		statusCode: '201',
	})
	public async listMembers(@Param('teamId') teamId: number, @QueryParams() query: any, @CurrentUser() user?: UserEntity) {
		const [data, total] = await this.service.listMembers(teamId, query, user);
		return new SuccessResponse({ data, total });
	}

	@Authorized()
	@Post(':teamId/invite')
	@OpenAPI({
		description: `Invite users to team with emails`,
		security: [
			{
				bearerAuth: [],
			},
		],
	})
	async inviteToTeam(
		@Param('teamId') teamId: number,
		@Body() body: { emails: string[]; brandId: string },
		@CurrentUser({ required: true }) user: UserEntity
	) {
		const data = await this.service.invite({ ...body, teamId, userId: user.id }, user);
		return new SuccessResponse({ data });
	}

	@Authorized()
	@Delete(':teamId/invite/:teamMembershipId')
	@OpenAPI({
		description: `Delete team invite by team membership ID`,
		security: [
			{
				bearerAuth: [],
			},
		],
	})
	@ResponseSchema(TeamMemberEntity, {
		contentType: 'application/json',
		description: 'Deleted team membership record',
		statusCode: '201',
	})
	async deleteMembershipById(@Param('teamMembershipId') teamMembershipId: number, @CurrentUser({ required: true }) user: UserEntity) {
		const data = await this.service.deleteInvite(teamMembershipId, user);
		return new SuccessResponse({ data });
	}

	@Authorized()
	@Post(':teamId/member/:memberId')
	@OpenAPI({
		description: `Add member to team`,
		security: [
			{
				bearerAuth: [],
			},
		],
	})
	@ResponseSchema(TeamEntity, {
		contentType: 'application/json',
		description: 'Single team record',
		statusCode: '201',
	})
	async addMember(
		@Param('memberId') memberId: number,
		@Param('teamId') teamId: number,
		@Body() { email }: { email?: string },
		@CurrentUser() user?: UserEntity
	) {
		const data = await this.service.addMember({ teamId, memberId, email, createdById: user?.id }, user);
		return new SuccessResponse({ data });
	}

	@Authorized()
	@Delete(':teamId/member/:userId')
	@OpenAPI({
		description: 'Delete member from team',
		security: [
			{
				bearerAuth: [],
			},
		],
	})
	@ResponseSchema(TeamMemberEntity, {
		contentType: 'application/json',
		description: 'Deleted team member record',
		statusCode: '201',
	})
	async deleteMember(@Param('userId') userId: number, @Param('teamId') teamId: number, @CurrentUser() user?: UserEntity) {
		const data = await this.service.deleteMember(teamId, userId, user);
		return new SuccessResponse({ data });
	}
}
