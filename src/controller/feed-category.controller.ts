import { Authorized, Get, JsonController, Param, CurrentUser, QueryParams } from 'routing-controllers';
import AbstractControllerTemplate from '@utils/abstract.controller.template';
import { Inject, Service } from 'typedi';
import UserEntity from '@entity/user.entity';
import FeedCategoryService from '@services/feed-category.service';
import { OpenAPI, ResponseSchema } from '@utils/openapi';
import FeedCategoryEntity from '@entity/feed-category.entity';
import FeedCategoryFilter from 'dd-common-blocks/dist/interface/filter/feed-category-filter.interface';

@Service()
@JsonController('/feed-category/')
export class FeedCategoryController extends AbstractControllerTemplate {
	@Inject()
	service: FeedCategoryService;

	@Authorized()
	@Get(':id')
	@ResponseSchema(FeedCategoryEntity, {
		contentType: 'application/json',
		description: 'Single feed category',
		isArray: false,
		statusCode: '201',
	})
	@OpenAPI({
		description: `Get single record`,
		security: [
			{
				bearerAuth: [],
			},
		],
	})
	public async single(@Param('id') id: number, @CurrentUser() user?: UserEntity) {
		return super.single(id, user);
	}

	@Authorized()
	@Get()
	@ResponseSchema(FeedCategoryEntity, {
		contentType: 'application/json',
		description: 'List of feed categories',
		isArray: true,
		statusCode: '201',
	})
	@OpenAPI({
		description: `Get records list`,
		security: [
			{
				bearerAuth: [],
			},
		],
	})
	public async list(@QueryParams() query: FeedCategoryFilter, @CurrentUser() user?: UserEntity) {
		return super.list(query, user);
	}
}
