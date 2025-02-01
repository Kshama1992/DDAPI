import { CurrentUser, Get, JsonController, QueryParams } from 'routing-controllers';
import AbstractControllerTemplate from '@utils/abstract.controller.template';
import { Inject, Service } from 'typedi';
import { OpenAPI } from '@utils/openapi';
import SpaceTypeService from '@services/space-type.service';
import type UserEntity from '@src/entity/user.entity';
import SpacetypeFilterRequest from '@src/dto/spacetype-filter-request';
import { plainToClass } from 'class-transformer';
import winstonLogger from '@src/utils/helpers/winston-logger';
import { SuccessResponse } from '@src/utils/response/success.response';


@Service()
@OpenAPI({
	description: `Space type controller`,
})
@JsonController('/space-type/')
export class SpaceTypeController extends AbstractControllerTemplate {
	@Inject()
	service: SpaceTypeService;

	@OpenAPI({
		description: `Entities list`,
	})

	@Get()
	public async list(@QueryParams() query: any, @CurrentUser() user?: UserEntity) {

		winstonLogger.info(`SpaceTypeController.list user: ${JSON.stringify(user)}`);
		const filterCriteria: SpacetypeFilterRequest = plainToClass(SpacetypeFilterRequest, query, { enableImplicitConversion: true });
		winstonLogger.info(`SpaceTypeController.list filter criteria: ${JSON.stringify(filterCriteria)}`);
		const [data, total] = await this.service.list(filterCriteria, user);
		
		return new SuccessResponse({ data, total });
	}
}
