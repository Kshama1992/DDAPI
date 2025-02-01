import { Authorized, Get, JsonController, Param, CurrentUser, QueryParams, Post, Body, Delete } from 'routing-controllers';
import AbstractControllerTemplate from '@utils/abstract.controller.template';
import { Inject, Service } from 'typedi';
import UserEntity from '@entity/user.entity';
import InvoiceService from '@services/invoice.service';
import { SuccessResponse } from '@utils/response/success.response';
import { OpenAPI } from '@utils/openapi';
import ReservationService from '@services/reservation.service';
import { NotFoundErrorResp } from '@utils/response/not-found.response';
import { MAX_UPLOAD_SIZE } from '@src/config';
import CreateInvoiceDto from '@src/dto/create-invoice.dto';
import QueryInvoiceDto from '@src/dto/query-invoice.dto';
import { JSONGenerateResponses, JSONGenerateSecurity } from '@utils/openapi/json.generators';
import CheckInDto from '@src/dto/check-in.dto';
import CheckOutDto from '@src/dto/check-out.dto';
import ChangeInvoiceStatusDto from '@src/dto/change-invoice-status.dto';
import { ForbiddenResponse } from '@utils/response/forbidden.response';
import { plainToClass } from 'class-transformer';
import winstonLogger from '@src/utils/helpers/winston-logger';

@Service()
@JsonController('/invoice/')
export class InvoiceController extends AbstractControllerTemplate {
	@Inject()
	service: InvoiceService;

	@Inject()
	reservationService: ReservationService;

	@Authorized()
	@Get(':id')
	@OpenAPI({
		description: `Get single invoice`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'InvoiceEntity', codes: [200, 401, 403, 404] }),
	})
	public async single(@Param('id') id: number, @CurrentUser() user?: UserEntity) {
		return super.single(id, user);
	}

	@Authorized()
	@Post()
	@OpenAPI({
		description: `Create single entity`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'InvoiceEntity', codes: [200, 401, 403, 404] }),
	})
	public async create(@Body({ options: { limit: MAX_UPLOAD_SIZE } }) body: CreateInvoiceDto, @CurrentUser({ required: true }) user: UserEntity) {
		await this.validateParams(this.service.entity, body, user);
		const data = await this.service.create(body, false, user);
		return new SuccessResponse({ data });
	}

	@Authorized()
	@Post(':id/change-status')
	@OpenAPI({
		description: `Change invoice status`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'InvoiceEntity', codes: [200, 401, 403, 404] }),
	})
	public async changeStatus(@Param('id') id: number, @Body() body: ChangeInvoiceStatusDto, @CurrentUser({ required: true }) user: UserEntity) {
		const data = await this.service.changeStatus(id, body, user);
		return new SuccessResponse({ data });
	}

	@Authorized()
	@Get()
	@OpenAPI({
		description: `List invoices`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'InvoiceEntity', codes: [200, 401, 403], successArray: true, successWithTotal: true }),
	})
	public async list(@QueryParams() query: QueryInvoiceDto) {
		const queryCriteria: QueryInvoiceDto = plainToClass(QueryInvoiceDto, query, { enableImplicitConversion: true });
		winstonLogger.info(`invoiceController.list: ${JSON.stringify(queryCriteria)}`);
		const [data, total] = await this.service.list(queryCriteria);
		return new SuccessResponse({ data, total });
	}

	@Authorized()
	@Post('check-in')
	@OpenAPI({
		description: `Create check-in`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'InvoiceEntity', codes: [200, 401, 403, 404] }),
	})
	public async checkIn(
		@Body()
		body: CheckInDto,
		@CurrentUser({ required: true }) user: UserEntity
	) {
		if (typeof body.spaceId !== 'number') throw new NotFoundErrorResp();
		const data = await this.service.createCheckIn({ ...body, createdById: user.id.toString() });
		return new SuccessResponse({ data });
	}

	@Authorized()
	@Post('charge-hours')
	@OpenAPI({
		description: `Check-out user`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'InvoiceEntity', codes: [200, 401, 403, 404] }),
	})
	public async checkOut(@Body() body: CheckOutDto, @CurrentUser({ required: true }) user: UserEntity) {
		if (typeof body.reservationId !== 'number') throw new NotFoundErrorResp();
		const data = await this.service.finishCheckIn(body, user);
		return new SuccessResponse({ data });
	}

	@Authorized()
	@OpenAPI({
		description: `Delete single entity`,
		security: JSONGenerateSecurity(),
		responses: JSONGenerateResponses({ schemaName: 'InvoiceEntity', codes: [403] }),
	})
	@Delete(':id')
	// @ts-ignore
	public async delete(@Param('id') id: number, @CurrentUser({ required: true }) user: UserEntity) {
		throw new ForbiddenResponse();
	}
}
