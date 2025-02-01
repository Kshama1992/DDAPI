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
import { TestBrandSecond, TestSpaceType, TestSpaceTypeSecond } from '@utils/tests/base-data';
import getRandomTextHelper from '@helpers/get-random-text.helper';
import SpaceTypeEntity from '@entity/space-type.entity';
import SpaceTypeLogicType from 'dd-common-blocks/dist/type/SpaceTypeLogicType';

const url = '/space-type';

describe(`ROUTE: /space-type`, () => {
	it('GET with filter should return 200 & valid response and array', async () => {
		await TestIntListMethod({ url, entity: SpaceTypeEntity, filter: { brandId: TestBrandSecond.id } });
	});

	it('GET should return 200 for brand owner & single object', async () => {
		await TestIntSingleMethod({ id: TestSpaceType.id, url, entity: SpaceTypeEntity, asAdmin: true });
	});

	it('GET should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ method: 'get', id: 9999, url, entity: SpaceTypeEntity, asSuperAdmin: true });
	});

	it('PUT should return 200 and updated object', async () => {
		const random = getRandomTextHelper(12);
		const updateObj = {
			name: `Test v type renamed ${random}`,
		};
		await TestIntUpdateMethod({ updateObj, id: TestSpaceType.id, url, entity: SpaceTypeEntity, asSuperAdmin: true });
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

		await TestInt422Method({ obj, id: TestSpaceType.id, url, method: 'put', entity: SpaceTypeEntity, asSuperAdmin: true, expectedErrors });
	});

	it('PUT should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ id: 9999, method: 'put', obj: TestSpaceType, url, entity: SpaceTypeEntity, asSuperAdmin: true });
	});

	it('PUT should return 401 for not authorized user', async () => {
		await TestInt401Method({ id: 9999, url, method: 'put', entity: SpaceTypeEntity });
	});

	it('PUT should return 403 for member', async () => {
		await TestInt403Method({ id: TestSpaceType.id, url, method: 'put', entity: SpaceTypeEntity, asMember: true });
	});

	it('POST should return 200 and newly created object', async () => {
		await TestIntCreateMethod({ createObj: TestSpaceType, url, entity: SpaceTypeEntity, asSuperAdmin: true });
	});

	it('POST should return 401 for not authorized user', async () => {
		await TestInt401Method({ url, method: 'post', entity: SpaceTypeEntity });
	});

	it('POST should return 403 for member', async () => {
		await TestInt403Method({
			obj: { name: 'test space type 213', alias: 'test-space-type-123', logicType: SpaceTypeLogicType.MONTHLY },
			url,
			method: 'post',
			entity: SpaceTypeEntity,
			asMember: true,
		});
	});

	it('POST should return 422 error', async () => {
		const obj = { name: '' };
		const expectedErrors = [
			{
				property: 'name',
			},
		];

		await TestInt422Method({ obj, url, method: 'post', entity: SpaceTypeEntity, asSuperAdmin: true, expectedErrors });
	});

	it('DELETE should throw error for not authorized user', async () => {
		await TestInt401Method({ id: TestSpaceType.id, url, method: 'delete', entity: SpaceTypeEntity });
	});

	it('DELETE should return 401 for member', async () => {
		await TestInt403Method({ id: TestSpaceType.id, url, method: 'delete', entity: SpaceTypeEntity, asMember: true });
	});

	it('DELETE should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ id: 9999, method: 'delete', url, entity: SpaceTypeEntity, asSuperAdmin: true });
	});

	it('DELETE should return 200 and deleted object', async () => {
		await TestIntDeleteMethod({ id: TestSpaceTypeSecond.id, url, entity: SpaceTypeEntity, asSuperAdmin: true });
	});
});
