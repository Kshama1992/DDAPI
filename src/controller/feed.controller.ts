import { Authorized, Get, JsonController, Param, CurrentUser, QueryParams, Body, Post } from 'routing-controllers';
import AbstractControllerTemplate from '@utils/abstract.controller.template';
import { Inject, Service } from 'typedi';
import UserEntity from '@entity/user.entity';
import FeedService from '@services/feed.service';
import { SuccessResponse } from '@utils/response/success.response';
import { OpenAPI, ResponseSchema } from '@utils/openapi';
import FeedEntity from '@entity/feed.entity';
import FeedCommentEntity from '@entity/feed-comment.entity';
import FeedPinEntity from '@entity/feed-pin.entity';
import FeedLikeEntity from '@entity/feed-like.entity';

@Service()
@JsonController('/feed/')
export class FeedController extends AbstractControllerTemplate {
	@Inject()
	service: FeedService;

	@Authorized()
	@Get(':feedId')
	@ResponseSchema(FeedEntity, {
		contentType: 'application/json',
		description: 'Single feed item',
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
	public async single(@Param('feedId') feedId: number, @CurrentUser() user?: UserEntity) {
		return super.single(feedId, user);
	}

	@Authorized()
	@Get()
	@ResponseSchema(FeedEntity, {
		contentType: 'application/json',
		description: 'Array of feeds with filter',
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
	public async list(@QueryParams() query: any, @CurrentUser() user?: UserEntity) {
		return super.list(query, user);
	}

	@Authorized()
	@Post(':feedId/comment')
	@ResponseSchema(FeedCommentEntity, {
		contentType: 'application/json',
		description: 'Single feed comment',
		statusCode: '201',
	})
	@OpenAPI({
		description: `Add comment to feed`,
		security: [
			{
				bearerAuth: [],
			},
		],
	})
	public async commentFeed(@Param('feedId') feedId: number, @Body() body: any, @CurrentUser({ required: true }) user: UserEntity) {
		const data = await this.service.comment(feedId, body, user);
		return new SuccessResponse({ data });
	}

	@Authorized()
	@Post(':feedId/report')
	@ResponseSchema(FeedEntity, {
		contentType: 'application/json',
		description: 'Single feed item',
		isArray: false,
		statusCode: '201',
	})
	@OpenAPI({
		description: `Report feed`,
		security: [
			{
				bearerAuth: [],
			},
		],
	})
	public async reportFeed(@Param('feedId') feedId: number) {
		const data = await this.service.report(feedId);
		return new SuccessResponse({ data });
	}

	@Authorized()
	@Post(':feedId/pin')
	@ResponseSchema(FeedPinEntity, {
		contentType: 'application/json',
		description: 'Single feed pin',
		isArray: false,
		statusCode: '201',
	})
	@OpenAPI({
		description: `Pin feed item`,
		security: [
			{
				bearerAuth: [],
			},
		],
	})
	public async pinFeed(@Param('feedId') feedId: number, @CurrentUser({ required: true }) user: UserEntity) {
		const data = await this.service.pin(feedId, user);
		return new SuccessResponse({ data });
	}

	@Authorized()
	@Post(':feedId/like')
	@ResponseSchema(FeedLikeEntity, {
		contentType: 'application/json',
		description: 'Single feed like',
		isArray: false,
		statusCode: '201',
	})
	@OpenAPI({
		description: `Like feed item`,
		security: [
			{
				bearerAuth: [],
			},
		],
	})
	public async likeFeed(@Param('feedId') feedId: number, @CurrentUser({ required: true }) user: UserEntity) {
		const data = await this.service.like(feedId, user);
		return new SuccessResponse({ data });
	}
}
