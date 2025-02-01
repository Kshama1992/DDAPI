import {
	TestInt401Method,
	TestInt403Method,
	TestInt422Method,
	TestIntCreateMethod,
	TestIntListMethod,
	TestIntSingleMethod,
	TestIntUpdate404Method,
	TestIntUpdateMethod,
} from '@controller/__tests__/base-service.spec';
import { TestInvoice } from '@utils/tests/base-data';
import InvoiceEntity from '@src/entity/invoice.entity';
import CreateInvoiceDto from '@src/dto/create-invoice.dto';
import dayjs from 'dayjs';

const url = '/invoice';

describe('ROUTE: /invoice', () => {
	it('GET with filter should return 200 & valid response and array', async () => {
		await TestIntListMethod({ url, entity: InvoiceEntity, filter: {}, asMember: true });
	});

	it('GET should return 200 for brand owner & single object', async () => {
		await TestIntSingleMethod({ id: TestInvoice.id, url, entity: InvoiceEntity, asAdmin: true });
	});

	it('GET should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ method: 'get', id: 9999, url, entity: InvoiceEntity, asSuperAdmin: true });
	});

	it('GET list should return 401 for not authorized user', async () => {
		await TestInt401Method({ url, method: 'get', entity: InvoiceEntity });
	});

	it('GET single should return 401 for not authorized user', async () => {
		await TestInt401Method({ id: TestInvoice.id, url, method: 'get', entity: InvoiceEntity });
	});

	it('PUT should return 200 and updated object', async () => {
		const updateObj = {
			subTotal: 150,
		};
		await TestIntUpdateMethod({ updateObj, id: TestInvoice.id, url, entity: InvoiceEntity, asSuperAdmin: true });
	});

	it('PUT should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ id: 9999, method: 'put', url, entity: InvoiceEntity, asSuperAdmin: true });
	});

	it('PUT should return 401 for not authorized user', async () => {
		await TestInt401Method({ id: 9999, url, method: 'put', entity: InvoiceEntity });
	});

	it('PUT should return 403 for non owner', async () => {
		await TestInt403Method({ id: 2, obj: { brandId: 999 }, method: 'put', url, entity: InvoiceEntity, asMember: true });
	});

	it('PUT should return 403 for other brand admin', async () => {
		await TestInt403Method({ id: 1, obj: { brandId: 999 }, method: 'put', url, entity: InvoiceEntity, asAdmin: true });
	});

	it('POST should return 200 and newly created object', async () => {
		const createObj: CreateInvoiceDto = { ...TestInvoice, startDate: new Date().toString(), endDate: dayjs().add(1, 'year').toString() };
		await TestIntCreateMethod({
			createObj,
			url,
			entity: InvoiceEntity,
			asSuperAdmin: true,
		});
	});

	it('POST should return 401 for not authorized user', async () => {
		await TestInt401Method({ url, method: 'post', entity: InvoiceEntity });
	});

	it('POST should return 422 error', async () => {
		const obj = { startDate: '' };
		const expectedErrors = [
			{
				property: 'startDate',
			},
		];

		await TestInt422Method({ obj, url, method: 'post', entity: InvoiceEntity, asSuperAdmin: true, expectedErrors });
	});

	it('DELETE should throw error for not authorized user', async () => {
		await TestInt401Method({ id: TestInvoice.id, url, method: 'delete', entity: InvoiceEntity });
	});

	it('DELETE should throw error for super admin', async () => {
		await TestInt403Method({ id: TestInvoice.id, url, method: 'delete', entity: InvoiceEntity, asSuperAdmin: true });
	});

	it('DELETE should return 403', async () => {
		await TestInt403Method({
			id: 9999,
			url,
			method: 'delete',
			entity: InvoiceEntity,
			asSuperAdmin: true,
		});
	});

	it('FINISH CHECK-IN should return 404 for reservation that not exist', async () => {
		await TestIntUpdate404Method({
			url: `${url}/charge-hours`,
			method: 'post',
			entity: InvoiceEntity,
			asMember: true,
			obj: { reservationId: '999' },
		});
	});

	it('FINISH CHECK-IN  should return 401 for not authorized user', async () => {
		await TestInt401Method({ url: `${url}/charge-hours`, method: 'post', entity: InvoiceEntity });
	});

	it('FINISH CHECK-IN should return 422 error with empty reservationId', async () => {
		const obj = { reservationId: '' };
		const expectedErrors = [
			{
				property: 'reservationId',
			},
		];

		await TestInt422Method({ obj, url: `${url}/charge-hours`, method: 'post', entity: InvoiceEntity, asSuperAdmin: true, expectedErrors });
	});

	// TODO after refactoring invoice service
	// it('FINISH CHECK-IN should return 200', async () => {
	// 	await TestIntCreateMethod({
	// 		createObj: { reservationId: TestInvoice.reservationId },
	// 		url: `${url}/charge-hours`,
	// 		entity: InvoiceEntity,
	// 		asMember: true,
	// 	});
	// });

	it('CREATE CHECK-IN  should return 401 for not authorized user', async () => {
		await TestInt401Method({ url: `${url}/check-in`, method: 'post', entity: InvoiceEntity });
	});

	it('CREATE CHECK-IN should return 422 error with no spaceId', async () => {
		const obj = { spaceId: '' };
		const expectedErrors = [
			{
				property: 'spaceId',
			},
		];

		await TestInt422Method({ obj, url: `${url}/check-in`, method: 'post', entity: InvoiceEntity, asSuperAdmin: true, expectedErrors });
	});

	it('CREATE CHECK-IN should return 404 error with no spaceId', async () => {
		const obj = { spaceId: '99999', userTz: 'America/New_York' };
		await TestIntUpdate404Method({ obj, url: `${url}/check-in`, method: 'post', entity: InvoiceEntity, asSuperAdmin: true });
	});

	it('CREATE CHECK-IN should return 404 for reservation that not exist', async () => {
		await TestIntUpdate404Method({
			url: `${url}/check-in`,
			method: 'post',
			entity: InvoiceEntity,
			asMember: true,
			obj: { spaceId: '99999', userId: '99999', userTz: 'America/New_York' },
		});
	});
});
