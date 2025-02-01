import { Authorized, CurrentUser, Get, JsonController, Param, QueryParams } from 'routing-controllers';
import AbstractControllerTemplate from '@utils/abstract.controller.template';
import { Inject, Service } from 'typedi';
import { OpenAPI } from '@utils/openapi';
import SpaceService from '@src/services/space.service';
import UserEntity from '@entity/user.entity';
import { SuccessResponse } from '@utils/response/success.response';
import GetSpaceAvailabilityDto from '@src/dto/get-space-availability.dto';
import { JSONGenerateResponses, JSONGenerateSecurity } from '@utils/openapi/json.generators';
import { plainToClass } from 'class-transformer';
import SpaceFilterRequest from '@src/dto/space-filter-request';
import winstonLogger from '@src/utils/helpers/winston-logger';

@Service()
@OpenAPI({
	description: `Space controller`,
})
@JsonController('/space/')
export class SpaceController extends AbstractControllerTemplate {

	@Inject()
	service: SpaceService;

	@OpenAPI({
		description: `Entities list`,
	})
	@Get()
	public async list(@QueryParams() query: any, @CurrentUser() user?: UserEntity) {

		const filterCriteria: SpaceFilterRequest = plainToClass(SpaceFilterRequest, query, { enableImplicitConversion: true });
		winstonLogger.info(`SpaceController.list: ${JSON.stringify(filterCriteria)}`);
		const [data, total] = await this.service.list(filterCriteria, user);
		
		return new SuccessResponse({ data, total });
	}

	@Get('list-pins')
	@OpenAPI({
		description: `List venues info for map`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'SpacePinsOutputInterface', codes: [200, 404] }),
	})
	public async listPins(@QueryParams() params: any, @CurrentUser() user?: UserEntity) {
		const filterCriteria: SpaceFilterRequest = plainToClass(SpaceFilterRequest, params, { enableImplicitConversion: true });
		winstonLogger.info(`SpaceController.list: ${JSON.stringify(filterCriteria)}`);
		const data = await this.service.listPins(filterCriteria, user);
		return new SuccessResponse({ data });
	}

	@Get('alias/:venueAlias/:spaceAlias')
	@OpenAPI({
		description: `Get space by space and venue alias`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'SpaceEntity', codes: [200, 404] }),
	})
	public async getByAlias(@Param('venueAlias') venueAlias: string, @Param('spaceAlias') spaceAlias: string, @CurrentUser() user?: UserEntity) {
		const data = await this.service.getSingleByAlias(spaceAlias, venueAlias);
		return new SuccessResponse({ data });
	}

	@Authorized()
	@Get(':spaceId/availability')
	@OpenAPI({
		description: `Get space available dates and time`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'AvailableDateWebInterface', codes: [200, 401, 403, 404] }),
	})
	public async getSpaceAvailability(
		@Param('spaceId') spaceId: number,
		@QueryParams()
		queryParams: GetSpaceAvailabilityDto
	) {
		const data = await this.service.getAvailable(spaceId, queryParams);
		return new SuccessResponse({ data });
	}
}
