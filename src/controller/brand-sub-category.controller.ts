import {CurrentUser, Get, JsonController, Param } from 'routing-controllers';
import AbstractControllerTemplate from '@utils/abstract.controller.template';
import { Inject, Service } from 'typedi';
import BrandSubCategoryService from '@services/brand-sub-category.service';
import { OpenAPI, ResponseSchema } from '@utils/openapi';
import { SuccessResponse } from '@src/utils/response/success.response';
import BrandSubCategory from '@src/entity/brand-sub-category.entity';
import UserEntity from '@src/entity/user.entity';

@Service()
@JsonController('/brand-sub-category/')
export class BrandCategoryController extends AbstractControllerTemplate {
	@Inject()
	service: BrandSubCategoryService;	

	@Get('all')
	@OpenAPI({
		description: `brand-categories`,
	})
	public async getBrandSubCategories() {
		const data = await this.service.listBrandSubCategories();
		return new SuccessResponse({ data });
	}

	@Get(':id')
	@OpenAPI({
		description: `Get single brand`,
		security: [
			{
				bearerAuth: [],
			},
		],
	})
	@ResponseSchema(BrandSubCategory, {
		contentType: 'application/json',
		description: 'Single BrandSubCategory object',
		statusCode: '201',
	})
	public async single(@Param('id') id: number, @CurrentUser() user?: UserEntity) {
		return super.single(id, user);
	}
	
}
