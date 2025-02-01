import { Authorized, Get, Post, JsonController, Param, Body, CurrentUser, QueryParams } from 'routing-controllers';
import AbstractControllerTemplate from '@utils/abstract.controller.template';
import { Inject, Service } from 'typedi';
import EmailTemplateService from '@services/email-template.service';
import UserEntity from '@entity/user.entity';
import { SuccessResponse } from '@utils/response/success.response';
import { OpenAPI } from '@utils/openapi';

@Service()
@JsonController('/email-template/')
export class EmailTemplateController extends AbstractControllerTemplate {
	@Inject()
	service: EmailTemplateService;

	@Authorized()
	@Get(':id')
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

	@Authorized()
	@Get()
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
	@Post(':id/test')
	@OpenAPI({
		description: `Send test email`,
		security: [
			{
				bearerAuth: [],
			},
		],
	})
	async testMail(@Param('id') id: number, @Body() { email }: { email: string }) {
		const resp = await this.service.testEmail(email, id);
		return new SuccessResponse({ data: resp });
	}
}
