import { JsonController } from 'routing-controllers';
import AbstractControllerTemplate from '@utils/abstract.controller.template';
import { Inject, Service } from 'typedi';
import { OpenAPI } from '@utils/openapi';
import UserPermissionsService from '@services/user-permissions.service';

@Service()
@OpenAPI({
	description: `User permissions controller`,
})
@JsonController('/user-permissions/')
export class UserPermissionsController extends AbstractControllerTemplate {
	@Inject()
	service: UserPermissionsService;
}
