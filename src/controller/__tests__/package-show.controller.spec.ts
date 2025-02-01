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
import { TestPackageShow } from '@utils/tests/base-data';
import getRandomTextHelper from '@helpers/get-random-text.helper';
import PackageShowEntity from '@src/entity/package-show.entity';

const url = '/package-show';

describe(`ROUTE: /package-show`, () => {
	it('GET with filter should return 200 & valid response and array', async () => {
		await TestIntListMethod({ url, entity: PackageShowEntity, filter: {} });
	});

	it('GET should return 200 for brand owner & single object', async () => {
		await TestIntSingleMethod({ id: TestPackageShow.id, url, entity: PackageShowEntity, asAdmin: true });
	});

	it('GET should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ method: 'get', id: 9999, url, entity: PackageShowEntity, asSuperAdmin: true });
	});

	it('PUT should return 200 and updated object', async () => {
		const random = getRandomTextHelper(12);
		const updateObj = {
			name: `Test v type renamed ${random}`,
		};
		await TestIntUpdateMethod({ updateObj, id: TestPackageShow.id, url, entity: PackageShowEntity, asSuperAdmin: true });
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

		await TestInt422Method({ obj, id: TestPackageShow.id, url, method: 'put', entity: PackageShowEntity, asSuperAdmin: true, expectedErrors });
	});

	it('PUT should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ id: 9999, method: 'put', url, entity: PackageShowEntity, obj: { name: 'Test show' }, asSuperAdmin: true });
	});

	it('PUT should return 401 for not authorized user', async () => {
		await TestInt401Method({ id: 9999, url, method: 'put', entity: PackageShowEntity });
	});

	it('PUT should return 403 for member', async () => {
		await TestInt403Method({ id: TestPackageShow.id, url, method: 'put', entity: PackageShowEntity, asMember: true });
	});

	it('POST should return 200 and newly created object', async () => {
		await TestIntCreateMethod<PackageShowEntity>({ createObj: TestPackageShow, url, entity: PackageShowEntity, asSuperAdmin: true });
	});

	it('POST should return 401 for not authorized user', async () => {
		await TestInt401Method({ url, method: 'post', entity: PackageShowEntity });
	});

	it('POST should return 403 for member', async () => {
		await TestInt403Method({ obj: { name: 'test amenity 213' }, url, method: 'post', entity: PackageShowEntity, asMember: true });
	});

	it('POST should return 422 error', async () => {
		const obj = { name: '' };
		const expectedErrors = [
			{
				property: 'name',
			},
		];

		await TestInt422Method({ obj, url, method: 'post', entity: PackageShowEntity, asSuperAdmin: true, expectedErrors });
	});

	it('DELETE should throw error for not authorized user', async () => {
		await TestInt401Method({ id: TestPackageShow.id, url, method: 'delete', entity: PackageShowEntity });
	});

	it('DELETE should return 401 for member', async () => {
		await TestInt403Method({ id: TestPackageShow.id, url, method: 'delete', entity: PackageShowEntity, asMember: true });
	});

	it('DELETE should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ id: 9999, method: 'delete', url, entity: PackageShowEntity, asSuperAdmin: true });
	});

	it('DELETE should return 200 and deleted object', async () => {
		await TestIntDeleteMethod({ id: TestPackageShow.id, url, entity: PackageShowEntity, asSuperAdmin: true });
	});
});
