import { Authorized, CurrentUser, JsonController, Param, Put, Body, Post, Delete, Get, QueryParams } from 'routing-controllers';
import AbstractControllerTemplate from '@utils/abstract.controller.template';
import { Inject, Service } from 'typedi';
import UserEntity from '@entity/user.entity';
import ApprovalStatus from 'dd-common-blocks/dist/type/ApprovalStatus';
import { SuccessResponse } from '@utils/response/success.response';
import { OpenAPI, ResponseSchema } from '@utils/openapi';
import GroupService from '@services/group.service';
import GroupEntity from '@entity/group.entity';
import GroupMemberEntity from '@entity/group-member.entity';

@Service()
@JsonController('/group/')
export class GroupController extends AbstractControllerTemplate {
	@Inject()
	service: GroupService;

	@Authorized()
	@Get(':id')
	@ResponseSchema(GroupEntity, {
		contentType: 'application/json',
		description: 'Single group object',
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
	@ResponseSchema(GroupEntity, {
		contentType: 'application/json',
		description: 'A list of groups',
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

	@Authorized()
	@Post(':groupId/member/:userId')
	@OpenAPI({
		description: `Add member to group`,
		security: [
			{
				bearerAuth: [],
			},
		],
	})
	@ResponseSchema(GroupMemberEntity, {
		contentType: 'application/json',
		description: 'Single group member record',
		statusCode: '201',
	})
	async addMember(
		@Param('userId') userId: number,
		@Param('groupId') groupId: number,
		@Body() { createdById }: { createdById?: number },
		@CurrentUser() user?: UserEntity
	) {
		const newData = {
			userId,
			status: ApprovalStatus.PENDING,
			createdById: createdById || userId,
			groupId,
		};

		const resp = await this.service.addMember(newData, user);
		return new SuccessResponse({ data: resp });
	}

	@Authorized()
	@Put(':groupId/member/:userId')
	@OpenAPI({
		description: `Approve member in group`,
		security: [
			{
				bearerAuth: [],
			},
		],
	})
	@ResponseSchema(GroupMemberEntity, {
		contentType: 'application/json',
		description: 'Single group member record',
		statusCode: '201',
	})
	async approveMember(@Param('userId') userId: number, @Param('groupId') groupId: number, @CurrentUser() user?: UserEntity) {
		const resp = await this.service.approveMember(groupId, userId, user);
		return new SuccessResponse({ data: resp });
	}

	@Authorized()
	@Delete(':groupId/member/:userId')
	@OpenAPI({
		description: 'Delete member from group',
		security: [
			{
				bearerAuth: [],
			},
		],
	})
	@ResponseSchema(GroupMemberEntity, {
		contentType: 'application/json',
		description: 'Deleted group member record',
		statusCode: '201',
	})
	async deleteMember(@Param('userId') userId: number, @Param('groupId') groupId: number, @CurrentUser() user?: UserEntity) {
		const resp = await this.service.deleteMember(groupId, userId, user);
		return new SuccessResponse({ data: resp });
	}
}
