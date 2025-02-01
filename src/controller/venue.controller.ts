import { Body, CurrentUser, Delete, Get, JsonController, Param, Post, QueryParams } from 'routing-controllers';
import AbstractControllerTemplate from '@utils/abstract.controller.template';
import { Inject, Service } from 'typedi';
import { OpenAPI, ResponseSchema } from '@utils/openapi';
import { SuccessResponse } from '@utils/response/success.response';
import { VenueService } from '@src/services';
import { UnauthorizedResponse } from '@utils/response/unauthorized.response';
import { ForbiddenResponse } from '@utils/response/forbidden.response';
import UserEntity from '@entity/user.entity';
import { plainToClass } from 'class-transformer';
import VenueFilterRequest from '@src/dto/venue-filter-request';

@Service()
@OpenAPI({
	description: `Venue controller`,
})
@JsonController('/venue/')
export class VenueController extends AbstractControllerTemplate {
	@Inject()
	service: VenueService;


	@OpenAPI({
		description: `Entities list`,
	})
	@Get()
	public async list(@QueryParams() query: any, @CurrentUser() user?: UserEntity) {

		const filterCriteria: VenueFilterRequest = plainToClass(VenueFilterRequest, query, { enableImplicitConversion: true });
		console.log('filterCriteria', filterCriteria);
		const [data, total] = await this.service.list(filterCriteria, user);
		
		return new SuccessResponse({ data, total });
	}

	@Post(':id/provider-data-update')
	@ResponseSchema(UnauthorizedResponse, {
		statusCode: '401',
		contentType: 'application/json',
		description: 'Error object',
	})
	@ResponseSchema(ForbiddenResponse, {
		statusCode: '403',
		contentType: 'application/json',
		description: 'Forbidden error object',
	})
	public async providerDataUpdate(@Param('id') venueId: number, @CurrentUser({ required: true }) user: UserEntity) {
		const data = await this.service.updateProviderData({ venueId }, user);
		return new SuccessResponse({ data });
	}

	@Post('provider-data-batch-update')
	@ResponseSchema(UnauthorizedResponse, {
		statusCode: '401',
		contentType: 'application/json',
		description: 'Error object',
	})
	@ResponseSchema(ForbiddenResponse, {
		statusCode: '403',
		contentType: 'application/json',
		description: 'Forbidden error object',
	})
	public async providerDataBatchUpdate(@CurrentUser({ required: true }) user: UserEntity) {
		const data = await this.service.batchUpdateProviderData(user);
		return new SuccessResponse({ data });
	}

	@Get('list-cities')
	@OpenAPI({
		description: `List cities`,
	})
	public async listCities() {
		const data = await this.service.listCities();
		return new SuccessResponse({ data });
	}

	@Get('list-locations')
	@OpenAPI({
		description: `List venues`,
	})
	public async listLocations(@QueryParams() query: VenueFilterRequest) {
		const filterCriteria: VenueFilterRequest = plainToClass(VenueFilterRequest, query, { enableImplicitConversion: true });
		console.log('filterCriteria', filterCriteria);
		const data = await this.service.listLocations(filterCriteria);
		return new SuccessResponse({ data });
	}

	@Get('v2/:id/getblockoutdates')
	@OpenAPI({
		description: `get blockout dates`,
	})
	public async getblockoutdates(@Param('id') userId: number ) {
		const data = await this.service.getBlockOutDates(userId);
		return new SuccessResponse({ data });
	}

	@Post('v2/:id/saveblockoutdates')
	@OpenAPI({
		description: `save blockout dates`,
	})
	public async saveblockoutdates(@Param('id') venueId: number , @Body() body: any) {
		const data = await this.service.saveBlockOutDates(venueId, body);
		return new SuccessResponse({ data });
	}

	@Delete('v2/:id/:dateId/deleteblockoutdates')
	@OpenAPI({
		description: `delete blockout dates`,
	})
	public async deleteblockoutdates(@Param('id') venueId: number , @Param('dateId') dateId: number)  {
		const data = await this.service.deleteBlockOutDates(venueId, dateId);
		return new SuccessResponse({ data });
	}
	
}
