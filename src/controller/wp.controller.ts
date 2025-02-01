import { Get, JsonController, QueryParams } from 'routing-controllers';
import { Inject, Service } from 'typedi';
import { OpenAPI } from '@utils/openapi';
import VenueService from '@services/venue.service';
import SpaceService from '@services/space.service';
import { SuccessResponse } from '@utils/response/success.response';

@Service()
@OpenAPI({
	description: `WordPress controller. Returns data for WP site.`,
})
@JsonController('/wp/')
export class WpController {
	@Inject()
	venueService: VenueService;
	@Inject()
	spaceService: SpaceService;

	@OpenAPI({
		description: `Venues list`,
	})
	@Get('venue')
	public async listVenue(@QueryParams() query: any) {
		const data = await this.venueService.listWp(query);
		return new SuccessResponse({ data });
	}

	@OpenAPI({
		description: `Space list`,
	})
	@Get('space')
	public async listSpace(@QueryParams() query: any) {
		const data = await this.spaceService.listWP(query);
		return new SuccessResponse({ ...data });
	}
}
