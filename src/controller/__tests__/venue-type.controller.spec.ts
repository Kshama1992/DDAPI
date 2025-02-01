import request from 'supertest';
import AuthService from '@src/services/auth.service';
import {
	TestInt401Method,
	TestInt403Method,
	TestInt422Method,
	TestIntCreateMethod,
	TestIntDeleteMethod,
	TestIntListMethod,
	TestIntSingleMethod,
	TestIntUpdate404Method,
	TestIntUpdateMethod,
} from '@controller/__tests__/base-service.spec';
import { TestVenueType, TestVenueTypeSecond } from '@utils/tests/base-data';
import getRandomTextHelper from '@helpers/get-random-text.helper';
import VenueTypeEntity from '@entity/venue-type.entity';
import { app } from '../../../jest.setup.env';

const url = '/venue-type';

const authService = new AuthService();

describe(`ROUTE: /venue-type`, () => {
	it('GET with filter should return 200 & valid response and array', async () => {
		await TestIntListMethod({ url, entity: VenueTypeEntity, filter: {} });
	});

	it('GET should return 200 for brand owner & single object', async () => {
		await TestIntSingleMethod({ id: TestVenueType.id, url, entity: VenueTypeEntity, asAdmin: true });
	});

	it('GET should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ method: 'get', id: 9999, url, entity: VenueTypeEntity, asSuperAdmin: true });
	});

	it('PUT should return 200 and updated object', async () => {
		const random = getRandomTextHelper(12);
		const updateObj = {
			name: `Test v type renamed ${random}`,
		};
		await TestIntUpdateMethod({ updateObj, id: TestVenueType.id, url, entity: VenueTypeEntity, asSuperAdmin: true });
	});

	it('PUT should return 422 error', async () => {
		const obj = {
			name: '',
		};

		const expectedErrors = [
			{
				property: 'name',
			},
		];

		await TestInt422Method({ obj, id: TestVenueType.id, url, method: 'put', entity: VenueTypeEntity, asSuperAdmin: true, expectedErrors });
	});

	it('PUT should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ id: 9999, method: 'put', url, entity: VenueTypeEntity, asSuperAdmin: true });
	});

	it('PUT should return 401 for not authorized user', async () => {
		await TestInt401Method({ id: 9999, url, method: 'put', entity: VenueTypeEntity });
	});

	it('PUT should return 403 for member', async () => {
		await TestInt403Method({ id: TestVenueType.id, url, method: 'put', entity: VenueTypeEntity, asMember: true });
	});

	it('POST should return 200 and newly created object', async () => {
		await TestIntCreateMethod({ createObj: TestVenueType, url, entity: VenueTypeEntity, asSuperAdmin: true });
	});

	it('POST should return 401 for not authorized user', async () => {
		await TestInt401Method({ url, method: 'post', obj: TestVenueTypeSecond, entity: VenueTypeEntity });
	});

	it('POST should return 403 for member', async () => {
		await TestInt403Method({ obj: { name: 'test amenity 213' }, url, method: 'post', entity: VenueTypeEntity, asMember: true });
	});

	it('POST should return 422 error', async () => {
		const obj = { name: '' };
		const expectedErrors = [
			{
				property: 'name',
			},
		];

		await TestInt422Method({ obj, url, method: 'post', entity: VenueTypeEntity, asSuperAdmin: true, expectedErrors });
	});

	it('DELETE should throw error for not authorized user', async () => {
		await TestInt401Method({ id: TestVenueTypeSecond.id, url, method: 'delete', entity: VenueTypeEntity });
	});

	it('DELETE should return 401 for member', async () => {
		await TestInt403Method({ id: TestVenueType.id, url, method: 'delete', entity: VenueTypeEntity, asMember: true });
	});

	it('DELETE should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ id: 9999, method: 'delete', url, entity: VenueTypeEntity, asSuperAdmin: true });
	});

	it('DELETE should return 200 and deleted object', async () => {
		await TestIntDeleteMethod({ id: TestVenueType.id, url, entity: VenueTypeEntity, asSuperAdmin: true });
	});

	it('POST should return error for non existing parent ID', async () => {
		const stateObj = {
			name: 'Other',
			alias: 'other',
			parentId: 0,
		};
		const { accessToken } = authService.generateToken(3);
		const { body, statusCode } = await request(app.app).post(url).set('auth', accessToken).send(stateObj);
		expect(statusCode).toBe(500);
		expect(body).toEqual(
			expect.objectContaining({
				message: 'Internal server error',
				code: 500,
				status: 'error',
			})
		);
	});

	it('POST should return error for non existing brand ID', async () => {
		const stateObj = {
			name: 'no brand id',
			alias: 'no-brand-id',
			brandId: 0,
		};
		const { accessToken } = await authService.generateToken(3);
		const { body, statusCode } = await request(app.app).post(url).set('auth', accessToken).send(stateObj);
		expect(statusCode).toBe(500);
		expect(body).toEqual(
			expect.objectContaining({
				message: 'Internal server error',
				code: 500,
				status: 'error',
			})
		);
	});
});
