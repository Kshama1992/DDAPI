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
import AmenityEntity from '@entity/amenity.entity';
import getRandomTextHelper from '@helpers/get-random-text.helper';
import { TestAmenity } from '@utils/tests/base-data';

const url = '/amenity';

describe('ROUTE: /amenity', () => {
	it('GET with filter should return 200 & valid response and array', async () => {
		await TestIntListMethod({ url, entity: AmenityEntity, filter: {} });
	});

	it('GET should return 200 for brand owner & single object', async () => {
		await TestIntSingleMethod({ id: TestAmenity.id, url, entity: AmenityEntity, asAdmin: true });
	});

	it('GET should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ method: 'get', id: 9999, url, entity: AmenityEntity, asSuperAdmin: true });
	});

	it('PUT should return 200 and updated object', async () => {
		const random = getRandomTextHelper(12);
		const updateObj = {
			name: `Test amenity renamed ${random}`,
		};
		await TestIntUpdateMethod({ updateObj, id: TestAmenity.id, url, entity: AmenityEntity, asSuperAdmin: true });
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

		await TestInt422Method({ obj, id: TestAmenity.id, url, method: 'put', entity: AmenityEntity, asSuperAdmin: true, expectedErrors });
	});

	it('PUT should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ id: 9999, method: 'put', url, entity: AmenityEntity, asSuperAdmin: true });
	});

	it('PUT should return 401 for not authorized user', async () => {
		await TestInt401Method({ id: 9999, url, method: 'put', entity: AmenityEntity });
	});

	it('PUT should return 403 for member', async () => {
		await TestInt403Method({ id: TestAmenity.id, url, method: 'put', entity: AmenityEntity, asMember: true });
	});

	it('POST should return 200 and newly created object', async () => {
		const random = getRandomTextHelper(12);
		await TestIntCreateMethod({
			createObj: { ...TestAmenity, name: `New amenity ${random}` },
			url,
			entity: AmenityEntity,
			asSuperAdmin: true,
		});
	});

	it('POST should return 401 for not authorized user', async () => {
		await TestInt401Method({ url, method: 'post', entity: AmenityEntity });
	});

	it('POST should return 403 for member', async () => {
		await TestInt403Method({ obj: { name: 'test amenity 213' }, url, method: 'post', entity: AmenityEntity, asMember: true });
	});

	it('POST should return 422 error', async () => {
		const obj = { name: '' };
		const expectedErrors = [
			{
				property: 'name',
			},
		];

		await TestInt422Method({ obj, url, method: 'post', entity: AmenityEntity, asSuperAdmin: true, expectedErrors });
	});

	it('DELETE should throw error for not authorized user', async () => {
		await TestInt401Method({ id: TestAmenity.id, url, method: 'delete', entity: AmenityEntity });
	});

	it('DELETE should return 401 for member', async () => {
		await TestInt403Method({ id: TestAmenity.id, url, method: 'delete', entity: AmenityEntity, asMember: true });
	});

	it('DELETE should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ id: 9999, method: 'delete', url, entity: AmenityEntity, asSuperAdmin: true });
	});

	it('DELETE should return 200 and deleted object', async () => {
		await TestIntDeleteMethod({ id: TestAmenity.id, url, entity: AmenityEntity, asSuperAdmin: true });
	});
});
