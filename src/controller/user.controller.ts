import { Authorized, Body, CurrentUser, Delete, Get, JsonController, Param, Post, Put, QueryParams } from 'routing-controllers';
import AbstractControllerTemplate from '@utils/abstract.controller.template';
import { Inject, Service } from 'typedi';
import UserEntity from '@entity/user.entity';
import { SuccessResponse } from '@utils/response/success.response';
import UserService from '@src/services/user.service';
import { OpenAPI } from '@utils/openapi';
import { MAX_UPLOAD_SIZE } from '@src/config';
import CreateUserDto from '@src/dto/create-user.dto';
import UpdateUserDto from '@src/dto/update-user.dto';
import ChangePasswordDto from '@src/dto/change-password.dto';
import UserPrivatePackageEntity from '@entity/user-private-package.entity';
import { JSONGenerateResponses, JSONGenerateSecurity } from '@utils/openapi/json.generators';
import QueryUserDto from '@src/dto/query-user.dto';
import UserSpaceHoursResponse from '@src/dto/response/user-space-hours.resp';
import InviteUserToBrandDto from '@src/dto/invite-user-to-brand.dto';
import ImportUsersValidateDto from '@src/dto/import-users-validate.dto';
import ImportUsersDto from '@src/dto/import-users.dto';
import CreateCCDto from '@src/dto/create-cc.dto';
import EditCcDto from '@src/dto/edit-cc.dto';
import Stripe from 'stripe';
import winstonLogger from '@src/utils/helpers/winston-logger';
import { plainToClass } from 'class-transformer';

@Service()
@JsonController('/user/')
@OpenAPI({
	description: `User controller`,
})
export class UserController extends AbstractControllerTemplate {

	@Inject()
	service: UserService;

	@Authorized()
	@Get(':id/private-packages')
	@OpenAPI({
		description: `List users private packages`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({
			schemaName: 'UserPrivatePackageEntity',
			codes: [200, 401, 403, 404],
			successWithTotal: true,
			successArray: true,
		}),
	})
	public async getPrivatePackages(
		@Param('id') userId: number,
		@CurrentUser() user?: UserEntity
	): Promise<SuccessResponse<UserPrivatePackageEntity[]>> {
		const [data, total] = await this.service.getUserPrivatePackages(userId, user);
		return new SuccessResponse({ data, total });
	}

	@Authorized()
	@Get(':id/space-credits')
	@OpenAPI({
		description: `Calculate credits available for user in space`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'UserSpaceHoursResponse', codes: [200, 401, 403, 404] }),
	})
	public async getSpaceCredits(
		@Param('id') userId: number,
		@QueryParams() { spaceIdsArray, creditsToDeduct }: { spaceIdsArray: number[]; creditsToDeduct?: number },
		@CurrentUser() user?: UserEntity
	): Promise<SuccessResponse<UserSpaceHoursResponse[]>> {
		const resp = await this.service._calcSpaceHours(userId, spaceIdsArray, creditsToDeduct, user);
		return new SuccessResponse({ data: resp });
	}

	@Authorized()
	@Get(':id/check-ins')
	@OpenAPI({
		description: `List user active check-ins`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'ReservationEntity', codes: [200, 401, 403, 404], successArray: true }),
	})
	public async getCheckIns(@Param('id') userId: number, @CurrentUser() user?: UserEntity) {
		console.log('************user controller userId', userId);
		console.log('************user controller user', user);

		const resp = await this.service.getCurrentCheckIn(userId, user);

		console.log('************user controller resp', resp);
		return new SuccessResponse({ data: resp });
	}

	@Authorized()
	@Get(':id/cards')
	@OpenAPI({
		description: `List user credit cards`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'StripeCardResp', codes: [200, 401, 403, 404], successArray: true }),
	})
	public async getUserCards(@Param('id') userId: number, @CurrentUser() user?: UserEntity) {
		const resp = await this.service.getCards(userId, user);
		return new SuccessResponse({ data: resp });
	}

	@Authorized()
	@Post(':id/cards')
	@OpenAPI({
		description: `Add credit card to user`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'StripeCardResp', codes: [200, 401, 403, 404], successArray: true }),
	})
	public async addUserCard(@Param('id') userId: number, @Body() body: CreateCCDto, @CurrentUser() user?: UserEntity) {
		const resp = await this.service.addCard(userId, body, user);
		return new SuccessResponse({ data: resp });
	}

	@Authorized()
	@Post('v2/:id/cards')
	@OpenAPI({
		description: `Add credit card to user`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'StripeCardResp', codes: [200, 401, 403, 404], successArray: true }),
	})
	public async addUserCardNew(@Param('id') userId: number, @Body() body: Stripe.Token, @CurrentUser() user?: UserEntity) {
			const resp = await this.service.addCardTokentoUser(userId, body as Stripe.Token , user);
			return new SuccessResponse({ data: resp });
		
	}

	@Authorized()
	@Put(':id/cards/:cardId')
	@OpenAPI({
		description: `Edit user credit card info`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'StripeCardResp', codes: [200, 401, 403, 404] }),
	})
	public async editUserCard(
		@Param('id') userId: number,
		@Param('cardId') cardId: string,
		@Body() body: EditCcDto,
		@CurrentUser() user?: UserEntity
	) {
		const resp = await this.service.updateCard(userId, cardId, body, user);
		return new SuccessResponse({ data: resp });
	}

	@Authorized()
	@Delete(':id/cards/:cardId')
	@OpenAPI({
		description: `Delete user credit card`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'StripeCardResp', codes: [200, 401, 403, 404], successArray: true }),
	})
	public async deleteUserCard(@Param('id') userId: number, @Param('cardId') cardId: string, @CurrentUser() user?: UserEntity) {
		const resp = await this.service.deleteCard(userId, cardId, user);
		return new SuccessResponse({ data: resp });
	}

	@Authorized()
	@Post(':id/cards/:cardId/set-default')
	@OpenAPI({
		description: `Set user default credit card`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'StripeCardResp', codes: [200, 401, 403, 404], successArray: true }),
	})
	public async setDefaultUserCard(@Param('id') userId: number, @Param('cardId') cardId: string, @CurrentUser() user?: UserEntity) {
		const resp = await this.service.setDefaultCard(userId, cardId, user);
		return new SuccessResponse({ data: resp });
	}

	@Authorized()
	@Get(':id/company')
	@OpenAPI({
		description: `Get user companies list`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'CompanyEntity', codes: [200, 401, 403], successArray: true }),
	})
	public async getUserCompanies(@Param('id') userId: number, @CurrentUser() user?: UserEntity) {
		const resp = await this.service.getCompany(userId, user);
		return new SuccessResponse({ data: resp });
	}

	@Authorized()
	@Get(':id/deposit')
	@OpenAPI({
		description: `Get user deposit value`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'UserDepositResponse', codes: [200, 401, 403, 404] }),
	})
	public async getUserDeposit(@Param('id') userId: number, @CurrentUser() user?: UserEntity) {
		const resp = await this.service.getDeposit(userId, user);
		return new SuccessResponse({ data: resp });
	}

	@Authorized()
	@Put(':id/suspend')
	@OpenAPI({
		description: `Suspend user`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ codes: [200, 401, 403, 404] }),
	})
	public async suspendUser(@Param('id') userId: number, @CurrentUser() user?: UserEntity) {
		const resp = await this.service.suspendUser(userId, user);
		return new SuccessResponse({ data: resp });
	}

	@Authorized()
	@Post(':id/move-out')
	@OpenAPI({
		description: `Move out user`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'UserEntity', codes: [200, 401, 403, 404] }),
	})
	public async moveOutUser(@Param('id') userId: number, @CurrentUser({ required: true }) user: UserEntity) {
		const resp = await this.service.moveOutUser(userId, user.id, user);
		return new SuccessResponse({ data: resp });
	}

	@Authorized()
	@Post(':id/getStripe')
	@OpenAPI({
		description: `get user stripe`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'UserEntity', codes: [200, 401, 403, 404] }),
	})
	public async getUserStripe(@Param('id') userId: number) {
		const resp = await this.service.getUserStripeKey(userId);
		return new SuccessResponse({ data: resp });
	}

	@Authorized()
	@Post(':id/activate')
	@OpenAPI({
		description: `Activate user`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'UserEntity', codes: [200, 401, 403, 404] }),
	})
	public async activateUser(@Param('id') userId: number, @CurrentUser() user?: UserEntity) {
		const resp = await this.service.activateUser(userId, user);
		return new SuccessResponse({ data: resp });
	}

	@Authorized()
	@Put(':id/update-member')
	@OpenAPI({
		description: `Update user data. For admin panel`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'UserEntity', codes: [200, 401, 403, 404] }),
	})
	public async updateMember(@Param('id') userId: number, @Body() body: UpdateUserDto, @CurrentUser() user?: UserEntity) {
		const bodyCriteria: UpdateUserDto = plainToClass(UpdateUserDto, body, { enableImplicitConversion: true });
		const resp = await this.service.updateMember(userId, bodyCriteria, user);
		return new SuccessResponse({ data: resp });
	}

	@Authorized()
	@Put(':id/change-password')
	@OpenAPI({
		description: `Change user password`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ codes: [200, 401, 403, 404] }),
	})
	public async changePassword(@Param('id') userId: number, @Body() body: ChangePasswordDto, @CurrentUser({ required: true }) user: UserEntity) {
		await this.service.changePassword(userId, body, user);
		return new SuccessResponse({ data: {} });
	}

	@Authorized()
	@Post('invite')
	@OpenAPI({
		description: `Invite user to brand`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ codes: [200, 401, 404] }),
	})
	public async inviteUsersToBrand(@Body() body: InviteUserToBrandDto, @CurrentUser() user?: UserEntity) {
		const bodyCriteria: InviteUserToBrandDto = plainToClass(InviteUserToBrandDto, body, { enableImplicitConversion: true });
		const resp = await this.service.inviteUsersToBrand(bodyCriteria, user);
		return new SuccessResponse({ data: resp });
	}

	@Authorized()
	@Post('import')
	@OpenAPI({
		description: `Import users from xml`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ codes: [200, 401, 403] }),
	})
	public async importUsers(@Body() body: ImportUsersDto, @CurrentUser({ required: true }) user: UserEntity) {
		const resp = await this.service.importUsers(body.users, user);
		return new SuccessResponse({ data: resp });
	}

	@Authorized()
	@Post('validate-import')
	@OpenAPI({
		description: `Validate username, phone and email data before import`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'ImportUsersValidateResp', codes: [200, 401, 403] }),
	})
	public async validateImportUsers(@Body() body: ImportUsersValidateDto, @CurrentUser({ required: true }) user: UserEntity) {
		const resp = await this.service._validateImport(body, user);
		return new SuccessResponse({ data: resp });
	}

	@Authorized()
	@Get(':id')
	@OpenAPI({
		description: `Get single record`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'UserEntity', codes: [200, 401, 403, 404] }),
	})
	public async single(@Param('id') userId: number, @CurrentUser() user?: UserEntity) {
		return super.single(userId, user);
	}

	@Authorized()
	@Get()
	@OpenAPI({
		description: `Get records list`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'UserEntity', codes: [200, 403], successArray: true, successWithTotal: true }),
	})
	public async list(@QueryParams() query: QueryUserDto, @CurrentUser() user?: UserEntity) {
		const queryCriteria: QueryUserDto = plainToClass(QueryUserDto, query, { enableImplicitConversion: true });
		winstonLogger.info(`userController.list: ${JSON.stringify(queryCriteria)}`);
		const [data, total] = await this.service.list(queryCriteria, user);
		return new SuccessResponse({ data, total });
	}

	@Authorized()
	@OpenAPI({
		description: `Create single entity`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'UserEntity', codes: [200, 401, 403] }),
	})
	@Post()
	public async create(@Body({ options: { limit: MAX_UPLOAD_SIZE } }) body: CreateUserDto, @CurrentUser({ required: true }) user: UserEntity) {
		await this.validateParams(this.service.entity, body, user);
		const data = await this.service.create({ ...body, createdById: body.createdById || user.id }, user);
		return new SuccessResponse({ data });
	}

	@Authorized()
	@OpenAPI({
		description: `Update single user profile`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'UserEntity', codes: [200, 401, 403, 404] }),
	})
	@Put(':id')
	public async update(
		@Body({ options: { limit: MAX_UPLOAD_SIZE } }) body: UpdateUserDto,
		@Param('id') id: number,
		@CurrentUser({ required: true }) user: UserEntity
	) {
		const resp = await this.service.update(id, body, user);
		return new SuccessResponse({ data: resp });
	}

	@Authorized()
	@OpenAPI({
		description: `Delete single user`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'UserEntity', codes: [200, 401, 403, 404] }),
	})
	@Delete(':id')
	public async delete(@Param('id') id: number, @CurrentUser({ required: true }) user: UserEntity) {
		const resp = await this.service.delete(id, user);
		return new SuccessResponse({ data: resp });
	}

	@Authorized()
	@Post(':id/savetoken')
	@OpenAPI({
		description: `Add credit card to user`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'StripeCardResp', codes: [200, 401, 403, 404], successArray: true }),
	})
	public async saveToken(@Param('id') userId: number, @Body() body: any, @CurrentUser() user?: UserEntity) {
		const resp = await this.service.saveFcmToken(userId, body);
		return new SuccessResponse({ data: resp });
	}
}
