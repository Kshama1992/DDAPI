import { Authorized, Get, JsonController, Param, CurrentUser, QueryParams, Put, Body } from 'routing-controllers';
import AbstractControllerTemplate from '@utils/abstract.controller.template';
import { Inject, Service } from 'typedi';
import UserEntity from '@entity/user.entity';
import SubscriptionService from '@services/subscription.service';
import { OpenAPI } from '@utils/openapi';
import { MAX_UPLOAD_SIZE } from '@src/config';
import { SuccessResponse } from '@utils/response/success.response';
import { JSONGenerateResponses, JSONGenerateSecurity } from '@utils/openapi/json.generators';
import UpdateSubscriptionDto from '../dto/update-subscription.dto';

@Service()
@JsonController('/subscription/')
export class SubscriptionController extends AbstractControllerTemplate {
	@Inject()
	service: SubscriptionService;

	@Authorized()
	@Get(':id')
	@OpenAPI({
		description: `Get single record`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'SubscriptionEntity', codes: [200, 401, 403, 404] }),
	})
	public async single(@Param('id') id: number, @CurrentUser() user?: UserEntity) {
		return super.single(id, user);
	}

	@Authorized()
	@Get()
	@OpenAPI({
		description: `Get records list`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'SubscriptionEntity', codes: [200, 401, 403], successArray: true, successWithTotal: true }),
	})
	public async list(@QueryParams() query: any, @CurrentUser() user?: UserEntity) {
		return super.list(query, user);
	}

	@Authorized()
	@OpenAPI({
		description: `Update single subscription`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'SubscriptionEntity', codes: [200, 401, 403], successArray: true, successWithTotal: true }),
	})
	@Put(':id')
	public async update(
		@Body({ options: { limit: MAX_UPLOAD_SIZE } }) body: UpdateSubscriptionDto,
		@Param('id') id: number,
		@CurrentUser({ required: true }) user: UserEntity
	) {
		const resp = await this.service.update(id, { ...body, updatedById: user?.id }, user);
		return new SuccessResponse({ data: resp });
	}
}
