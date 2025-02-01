import { Authorized,  CurrentUser, Get, JsonController, Param, QueryParams } from 'routing-controllers';
import AbstractControllerTemplate from '@utils/abstract.controller.template';
import { Inject, Service } from 'typedi';
import BrandService from '@services/brand.service';
import UserEntity from '@entity/user.entity';
import { OpenAPI, ResponseSchema } from '@utils/openapi';
import BrandEntity from '@entity/brand.entity';
import { SuccessResponse } from '@src/utils/response/success.response';
import BrandFilterRequest from '@src/dto/brand-filter-request';
import { plainToClass } from 'class-transformer';

@Service()
@JsonController('/brand/')
export class BrandController extends AbstractControllerTemplate {
	@Inject()
	service: BrandService;

	@Get()
	public async list(@QueryParams() query: any, @CurrentUser() user?: UserEntity) {

		const filterCriteria: BrandFilterRequest = plainToClass(BrandFilterRequest, query, { enableImplicitConversion: true });
		console.log('Brand filterCriteria', filterCriteria);
		const [data, total] = await this.service.list(filterCriteria, user);
		
		return new SuccessResponse({ data, total });
	}

	@Authorized()
	@Get('default-brand')
	@OpenAPI({
		description: `default-brand`,
	})
	public async defaultBrand() {
		const data = await this.service.getDefaultBrandDetail();
		return new SuccessResponse({ data });
	}

	@Authorized()
	@Get(':id')
	@OpenAPI({
		description: `Get single brand`,
		security: [
			{
				bearerAuth: [],
			},
		],
	})
	@ResponseSchema(BrandEntity, {
		contentType: 'application/json',
		description: 'Single brand object',
		statusCode: '201',
	})
	public async single(@Param('id') id: number, @CurrentUser() user?: UserEntity) {
		return super.single(id, user);
	}
}
