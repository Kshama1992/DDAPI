import { JsonController, CurrentUser, Get, Body, Authorized, Post } from 'routing-controllers';
import { OpenAPI } from '@utils/openapi';
import { getLinkPreview } from 'link-preview-js';
import UserEntity from '@entity/user.entity';
import { Service } from 'typedi';
import { SuccessResponse } from '@utils/response/success.response';

@JsonController('/')
@Service()
export class IndexController {
	// @Authorized()
	@Get()
	@OpenAPI({
		description: 'Simple index',
	})
	getAll(@CurrentUser() user?: UserEntity) {
		return 'Hello from Drop-desk!!';
	}

	@Authorized()
	@Post('link-preview')
	@OpenAPI({
		description: 'Link preview',
	})
	async getLinkPreview(@Body() { url }: { url: string }) {
		const data = await getLinkPreview(url);
		return new SuccessResponse({ data });
	}
}
