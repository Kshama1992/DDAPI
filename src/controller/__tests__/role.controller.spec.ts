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
import { TestRoleMember, TestRoleWithoutMembers } from '@utils/tests/base-data';
import getRandomTextHelper from '@helpers/get-random-text.helper';
import RoleEntity from '@entity/role.entity';
import BrandRoleType from 'dd-common-blocks/dist/type/BrandRoleType';

const url = '/role';

describe('ROUTE: /role', () => {
	it('GET with filter should return 200 & valid response and array', async () => {
		await TestIntListMethod({ url, entity: RoleEntity, filter: {}, asMember: true });
	});

	it('GET should return 200 for brand owner & single object', async () => {
		await TestIntSingleMethod({ id: TestRoleMember.id, url, entity: RoleEntity, asAdmin: true });
	});

	it('GET should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ method: 'get', id: 9999, url, entity: RoleEntity, asSuperAdmin: true });
	});

	it('GET list should return 401 for not authorized user', async () => {
		await TestInt401Method({ url, method: 'get', entity: RoleEntity });
	});

	it('GET single should return 401 for not authorized user', async () => {
		await TestInt401Method({ id: TestRoleMember.id, url, method: 'get', entity: RoleEntity });
	});

	it('PUT should return 200 and updated object', async () => {
		const random = getRandomTextHelper(12);
		const updateObj = {
			...TestRoleMember,
			name: `Test role renamed ${random}`,
		};
		await TestIntUpdateMethod({ updateObj, id: TestRoleMember.id, url, entity: RoleEntity, asSuperAdmin: true });
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

		await TestInt422Method({ obj, id: TestRoleMember.id, url, method: 'put', entity: RoleEntity, asSuperAdmin: true, expectedErrors });
	});

	it('PUT should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ id: 9999, method: 'put', url, obj: TestRoleMember, entity: RoleEntity, asSuperAdmin: true });
	});

	it('PUT should return 401 for not authorized user', async () => {
		await TestInt401Method({ id: 9999, url, method: 'put', entity: RoleEntity });
	});

	it('PUT should return 403 for member', async () => {
		await TestInt403Method({ id: TestRoleMember.id, url, method: 'put', entity: RoleEntity, asMember: true });
	});

	it('POST should return 200 and newly created object', async () => {
		await TestIntCreateMethod<RoleEntity>({ createObj: TestRoleMember, url, entity: RoleEntity, asSuperAdmin: true });
	});

	it('POST should return 401 for not authorized user', async () => {
		await TestInt401Method({ url, method: 'post', entity: RoleEntity });
	});

	it('POST should return 403 for member', async () => {
		await TestInt403Method({
			obj: { name: 'test role 213', alias: 'test-role-123', roleType: BrandRoleType.MEMBER, brandId: 1 },
			url,
			method: 'post',
			entity: RoleEntity,
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

		await TestInt422Method({ obj, url, method: 'post', entity: RoleEntity, asSuperAdmin: true, expectedErrors });
	});

	it('DELETE should throw error for not authorized user', async () => {
		await TestInt401Method({ id: TestRoleMember.id, url, method: 'delete', entity: RoleEntity });
	});

	it('DELETE should return 403', async () => {
		await TestInt403Method({ id: TestRoleWithoutMembers.id, url, method: 'delete', entity: RoleEntity, asMember: true });
	});

	it('DELETE should return 403 for role with members', async () => {
		await TestInt403Method({
			id: TestRoleMember.id,
			url,
			method: 'delete',
			entity: RoleEntity,
			asMember: true,
		});
	});

	it('DELETE should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ id: 9999, method: 'delete', url, entity: RoleEntity, asSuperAdmin: true });
	});

	it('DELETE should return 200 and deleted object', async () => {
		await TestIntDeleteMethod({ id: TestRoleWithoutMembers.id, url, entity: RoleEntity, asSuperAdmin: true });
	});
});
