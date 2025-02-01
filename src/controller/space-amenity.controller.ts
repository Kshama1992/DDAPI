import { Authorized, Body, CurrentUser, Get, Put, JsonController, Param, Post, QueryParams } from 'routing-controllers';
import AbstractControllerTemplate from '@utils/abstract.controller.template';
import { Inject, Service } from 'typedi';
import { OpenAPI } from '@utils/openapi';
import SpaceAmenityService from '@services/space-amenity.service';
import UserEntity from '@entity/user.entity';
import { MAX_UPLOAD_SIZE } from '@src/config';
import { SuccessResponse } from '@utils/response/success.response';
import CreateSpaceAmenityDto from '@src/dto/create-space-amenity.dto';
import UpdateSpaceAmenityDto from '@src/dto/update-space-amenity.dto';
import { JSONGenerateResponses, JSONGenerateSecurity } from '@utils/openapi/json.generators';

@Service()
@OpenAPI({
	description: `Space Amenity controller`,
})
@JsonController('/space-amenity/')
export class SpaceAmenityController extends AbstractControllerTemplate {
	@Inject()
	service: SpaceAmenityService;

	@Authorized()
	@Get(':id')
	@OpenAPI({
		description: `Get single space amenity`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'SpaceAmenityEntity', codes: [200, 401, 403, 404] }),
	})
	public async single(@Param('id') id: number, @CurrentUser() user?: UserEntity) {
		return super.single(id, user);
	}

	@Authorized()
	@OpenAPI({
		description: `Create single entity`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'SpaceAmenityEntity', codes: [200, 401, 403] }),
	})
	@Post()
	public async create(
		@Body({ options: { limit: MAX_UPLOAD_SIZE } }) body: CreateSpaceAmenityDto,
		@CurrentUser({ required: true }) user: UserEntity) {

		try {
			//log body with message "Creating space amenity"
			console.log("Creating space amennity: ", body);

			await this.validateParams(this.service.entity, body, user);
			const data = await this.service.create(body, user);

			console.log("Space amenity created: ", data);
			return new SuccessResponse({ data });
		} catch (error) {
			console.error("Error occurred while creating space amenity: ", error);
			throw error;
		}
	}

	@Authorized()
	@OpenAPI({
		description: `Update single entity`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'SpaceAmenityEntity', codes: [200, 401, 403, 404] }),
	})
	@Put(':id')
	public async update(
		@Body({ options: { limit: MAX_UPLOAD_SIZE } }) body: UpdateSpaceAmenityDto,
		@Param('id') id: number,
		@CurrentUser({ required: true }) user: UserEntity
	) {
		await this.validateParams(this.service.entity, body, user);
		const data = await this.service.update(id, body, user);
		return new SuccessResponse({ data });
	}

	@Authorized()
	@Get()
	@OpenAPI({
		description: `List invoices`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'SpaceAmenityEntity', codes: [200, 401, 403], successArray: true, successWithTotal: true }),
	})
	public async list(@QueryParams() query: any, @CurrentUser() user?: UserEntity) {
		return super.list(query, user);
	}
}
