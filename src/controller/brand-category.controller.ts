import { Get, JsonController } from 'routing-controllers';
import AbstractControllerTemplate from '@utils/abstract.controller.template';
import { Inject, Service } from 'typedi';
import BrandCategoryService from '@services/brand-category.service';
import { OpenAPI } from '@utils/openapi';
import { SuccessResponse } from '@src/utils/response/success.response';

@Service()
@JsonController('/brand-category/')
export class BrandCategoryController extends AbstractControllerTemplate {
	@Inject()
	service: BrandCategoryService;	

	@Get('all')
	@OpenAPI({
		description: `get all brand-categories`,
	})
	public async getBrandCategories() {
		const data = await this.service.listBrandCategories();
		return new SuccessResponse({ data });
	}


}
