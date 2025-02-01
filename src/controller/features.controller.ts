import { Get, JsonController, QueryParams } from 'routing-controllers';
import { Inject, Service } from 'typedi';
import { OpenAPI } from '@utils/openapi';
import featureService from '@services/feature.service';
import { SuccessResponse } from '@utils/response/success.response';
import Feature from '../../src/interface/feature.interface';

@Service()
@OpenAPI({
	description: `feature controller. Returns all flags.`,
})
@JsonController('/feature/')
export class FeatureController {
	@Inject()
	featureService: featureService;

	@OpenAPI({
		description: `feature list`,
		security: [
			{
				bearerAuth: [],
			},
		],
	})
	@Get('list')
	public async listFeature(@QueryParams() query: Feature) {
		const data = await this.featureService.list();
		return new SuccessResponse({ data });
	}
}
