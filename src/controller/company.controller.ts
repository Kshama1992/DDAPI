import { Authorized, CurrentUser, JsonController, Param, Put, Body, Post, Delete, Get, QueryParams } from 'routing-controllers';
import AbstractControllerTemplate from '@utils/abstract.controller.template';
import { Inject, Service } from 'typedi';
import CompanyService from '@services/company.service';
import UserEntity from '@entity/user.entity';
import ApprovalStatus from 'dd-common-blocks/dist/type/ApprovalStatus';
import { SuccessResponse } from '@utils/response/success.response';
import CompanyEntity from '@entity/company.entity';
import { OpenAPI, ResponseSchema } from '@utils/openapi';

@Service()
@JsonController('/company/')
export class CompanyController extends AbstractControllerTemplate {
	@Inject()
	service: CompanyService;

	@Authorized()
	@Get(':id')
	@ResponseSchema(CompanyEntity, {
		contentType: 'application/json',
		description: 'Single company object',
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
	@ResponseSchema(CompanyEntity, {
		contentType: 'application/json',
		description: 'A list of companies',
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
	@Post(':companyId/member/:userId')
	@OpenAPI({
		description: `Add member to company`,
		security: [
			{
				bearerAuth: [],
			},
		],
	})
	async addMember(
		@Param('userId') userId: number,
		@Param('companyId') companyId: number,
		@Body() { createdById }: { createdById?: number },
		@CurrentUser() user?: UserEntity
	) {
		const newData = {
			userId,
			status: ApprovalStatus.PENDING,
			createdById: createdById || userId,
			companyId,
		};

		const resp = await this.service.addMember(newData, user);
		return new SuccessResponse({ data: resp });
	}

	@Authorized()
	@Put(':companyId/member/:userId')
	@OpenAPI({
		description: `Approve member in company`,
		security: [
			{
				bearerAuth: [],
			},
		],
	})
	async approveMember(@Param('userId') userId: number, @Param('companyId') companyId: number, @CurrentUser() user?: UserEntity) {
		const resp = await this.service.approveMember(companyId, userId, user);
		return new SuccessResponse({ data: resp });
	}

	@Authorized()
	@Delete(':companyId/member/:userId')
	@OpenAPI({
		description: 'Delete member from company',
		security: [
			{
				bearerAuth: [],
			},
		],
	})
	async deleteMember(@Param('userId') userId: number, @Param('companyId') companyId: number, @CurrentUser() user?: UserEntity) {
		const resp = await this.service.deleteMember(companyId, userId, user);
		return new SuccessResponse({ data: resp });
	}
}
