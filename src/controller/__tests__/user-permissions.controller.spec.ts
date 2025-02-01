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
import { TestUserPermission } from '@utils/tests/base-data';
import getRandomTextHelper from '@helpers/get-random-text.helper';
import UserPermissionEntity from '@entity/user-permission.entity';
import AccessLevel from 'dd-common-blocks/dist/type/AccessLevel';

const url = '/user-permissions';

describe(`ROUTE: /user-permissions`, () => {
	it('GET with filter should return 200 & valid response and array', async () => {
		await TestIntListMethod({ url, entity: UserPermissionEntity, filter: {} });
	});

	it('GET should return 200 for brand owner & single object', async () => {
		await TestIntSingleMethod({ id: TestUserPermission.id, url, entity: UserPermissionEntity, asAdmin: true });
	});

	it('GET should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ method: 'get', id: 9999, url, entity: UserPermissionEntity, asSuperAdmin: true });
	});

	it('PUT should return 200 and updated object', async () => {
		const random = getRandomTextHelper(12);
		const updateObj = {
			name: `Test perms renamed ${random}`,
		};
		await TestIntUpdateMethod({ updateObj, id: TestUserPermission.id, url, entity: UserPermissionEntity, asSuperAdmin: true });
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

		await TestInt422Method({
			obj,
			id: TestUserPermission.id,
			url,
			method: 'put',
			entity: UserPermissionEntity,
			asSuperAdmin: true,
			expectedErrors,
		});
	});

	it('PUT should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ id: 9999, method: 'put', url, entity: UserPermissionEntity, asSuperAdmin: true });
	});

	it('PUT should return 401 for not authorized user', async () => {
		await TestInt401Method({ id: 9999, url, method: 'put', entity: UserPermissionEntity });
	});

	it('PUT should return 403 for member', async () => {
		await TestInt403Method({ id: TestUserPermission.id, url, method: 'put', entity: UserPermissionEntity, asMember: true });
	});

	it('POST should return 200 and newly created object', async () => {
		await TestIntCreateMethod<UserPermissionEntity>({ createObj: TestUserPermission, url, entity: UserPermissionEntity, asSuperAdmin: true });
	});

	it('POST should return 401 for not authorized user', async () => {
		await TestInt401Method({ url, method: 'post', entity: UserPermissionEntity });
	});

	it('POST should return 403 for member', async () => {
		await TestInt403Method({
			obj: { name: 'test perms 213', accessLevel: AccessLevel.CUSTOMER },
			url,
			method: 'post',
			entity: UserPermissionEntity,
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

		await TestInt422Method({ obj, url, method: 'post', entity: UserPermissionEntity, asSuperAdmin: true, expectedErrors });
	});

	it('DELETE should throw error for not authorized user', async () => {
		await TestInt401Method({ id: TestUserPermission.id, url, method: 'delete', entity: UserPermissionEntity });
	});

	it('DELETE should return 401 for member', async () => {
		await TestInt403Method({ id: TestUserPermission.id, url, method: 'delete', entity: UserPermissionEntity, asMember: true });
	});

	it('DELETE should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ id: 9999, method: 'delete', url, entity: UserPermissionEntity, asSuperAdmin: true });
	});

	it('DELETE should return 200 and deleted object', async () => {
		await TestIntDeleteMethod({ id: TestUserPermission.id, url, entity: UserPermissionEntity, asSuperAdmin: true });
	});
});
