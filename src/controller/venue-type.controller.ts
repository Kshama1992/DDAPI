import { CurrentUser, Get, JsonController, QueryParams } from 'routing-controllers';
import AbstractControllerTemplate from '@utils/abstract.controller.template';
import { Inject, Service } from 'typedi';
import { OpenAPI } from '@utils/openapi';
import VenueTypeService from '@services/venue-type.service';
import type UserEntity from '@src/entity/user.entity';
import VenueTypeFilterRequest from '@src/dto/venuetype-filter-request';
import { plainToClass } from 'class-transformer';
import winstonLogger from '@src/utils/helpers/winston-logger';
import { SuccessResponse } from '@src/utils/response/success.response';

@Service()
@OpenAPI({
	description: `Venue type controller`,
})
@JsonController('/venue-type/')
export class VenueTypeController extends AbstractControllerTemplate {
	@Inject()
	service: VenueTypeService;

	@OpenAPI({
		description: `Entities list`,
	})
	@Get()
	public async list(@QueryParams() query: any, @CurrentUser() user?: UserEntity) {

		const filterCriteria: VenueTypeFilterRequest = plainToClass(VenueTypeFilterRequest, query, { enableImplicitConversion: true });
		winstonLogger.info(`VenueTypeController.list: ${JSON.stringify(filterCriteria)}`);
		const [data, total] = await this.service.list(filterCriteria);
		
		return new SuccessResponse({ data, total });
	}
}
