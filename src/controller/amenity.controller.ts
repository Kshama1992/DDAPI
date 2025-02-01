import { CurrentUser, Get, JsonController, QueryParams } from 'routing-controllers';
import AbstractControllerTemplate from '@utils/abstract.controller.template';
import { Inject, Service } from 'typedi';
import AmenityService from '@services/amenity.service';
import { OpenAPI } from '@utils/openapi';
import { SuccessResponse } from '@src/utils/response/success.response';
import type UserEntity from '@src/entity/user.entity';
import { plainToClass } from 'class-transformer';
import AmenityFilterRequest from '@src/dto/amenity-filter-request';

@Service()
@OpenAPI({
	description: `Amenity controller`,
})
@JsonController('/amenity/')
export class AmenityController extends AbstractControllerTemplate {

	@Inject()
	service: AmenityService;

	@Get()
	@OpenAPI({
		description: `Get list of amenities`,
	})

	@OpenAPI({
		description: `Entities list`,
	})
	@Get()
	public async list(@QueryParams() query: any, @CurrentUser() user?: UserEntity) {

		const filterCriteria: AmenityFilterRequest = plainToClass(AmenityFilterRequest, query, { enableImplicitConversion: true });
		console.log('filterCriteria', filterCriteria);
		const [data, total] = await this.service.list(filterCriteria, user);
		
		return new SuccessResponse({ data, total });
	}

}
