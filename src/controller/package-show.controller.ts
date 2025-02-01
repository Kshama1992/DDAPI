import { Authorized, Get, JsonController, Param, CurrentUser } from 'routing-controllers';
import AbstractControllerTemplate from '@utils/abstract.controller.template';
import { Inject, Service } from 'typedi';
import UserEntity from '@entity/user.entity';
import PackageShowService from '@services/package-show.service';
import { OpenAPI } from '@utils/openapi';

@Service()
@JsonController('/package-show/')
export class PackageShowController extends AbstractControllerTemplate {
	@Inject()
	service: PackageShowService;

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
}
