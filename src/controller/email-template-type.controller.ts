import { Authorized, Get, JsonController, Param, CurrentUser, QueryParams } from 'routing-controllers';
import AbstractControllerTemplate from '@utils/abstract.controller.template';
import { Inject, Service } from 'typedi';
import UserEntity from '@entity/user.entity';
import EmailTemplateTypeService from '@services/email-template-type.service';
import { OpenAPI } from '@utils/openapi';

@Service()
@JsonController('/email-template-type/')
export class EmailTemplateTypeController extends AbstractControllerTemplate {
	@Inject()
	service: EmailTemplateTypeService;

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
}
