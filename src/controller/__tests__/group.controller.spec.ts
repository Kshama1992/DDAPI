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
import { TestGroup, TestUserBrandMember } from '@utils/tests/base-data';
import getRandomTextHelper from '@helpers/get-random-text.helper';
import GroupEntity from '@entity/group.entity';

const url = '/group';

describe('ROUTE: /group', () => {
	it('GET with filter should return 200 & valid response and array', async () => {
		await TestIntListMethod({ url, entity: GroupEntity, filter: {}, asMember: true });
	});

	it('GET should return 200 for brand owner & single object', async () => {
		await TestIntSingleMethod({ id: TestGroup.id, url, entity: GroupEntity, asAdmin: true });
	});

	it('GET should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ method: 'get', id: 9999, url, entity: GroupEntity, asSuperAdmin: true });
	});

	it('GET single should return 401 for not authorized user', async () => {
		await TestInt401Method({ id: TestGroup.id, url, method: 'get', entity: GroupEntity });
	});

	it('PUT should return 200 and updated object as superadmin', async () => {
		const random = getRandomTextHelper(12);
		const updateObj = {
			name: `Test role renamed ${random}`,
		};
		await TestIntUpdateMethod({ updateObj, id: TestGroup.id, url, entity: GroupEntity, asSuperAdmin: true });
	});

	it('PUT should return 200 and updated object as owner', async () => {
		const random = getRandomTextHelper(12);
		const updateObj = {
			name: `Test role renamed ${random}`,
		};
		await TestIntUpdateMethod({ updateObj, id: TestGroup.id, url, entity: GroupEntity, asMember: true });
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

		await TestInt422Method({ obj, id: TestGroup.id, url, method: 'put', entity: GroupEntity, asSuperAdmin: true, expectedErrors });
	});

	it('PUT should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ id: 9999, method: 'put', url, entity: GroupEntity, asSuperAdmin: true });
	});

	it('PUT should return 401 for not authorized user', async () => {
		await TestInt401Method({ id: 9999, url, method: 'put', entity: GroupEntity });
	});

	it('POST should return 200 and newly created object', async () => {
		await TestIntCreateMethod({
			createObj: { ...TestGroup, userId: TestGroup.createdById },
			url,
			entity: GroupEntity,
			asSuperAdmin: true,
		});
	});

	it('POST should return 401 for not authorized user', async () => {
		await TestInt401Method({ url, method: 'post', entity: GroupEntity });
	});

	it('POST should return 422 error', async () => {
		const obj = { name: '' };
		const expectedErrors = [
			{
				property: 'name',
			},
		];

		await TestInt422Method({ obj, url, method: 'post', entity: GroupEntity, asSuperAdmin: true, expectedErrors });
	});

	it('addMember should return 401 for not authorized user', async () => {
		await TestInt401Method({ url: `${url}/${TestGroup.id}/member/${TestUserBrandMember.id}`, method: 'post', entity: GroupEntity });
	});

	it('addMember should return 403 for non owner', async () => {
		await TestInt403Method({
			url: `${url}/${TestGroup.id}/member/${TestUserBrandMember.id}`,
			method: 'post',
			entity: GroupEntity,
			asAdmin: true,
		});
	});

	it('addMember should return 404 for item that not exist', async () => {
		await TestIntUpdate404Method({
			url: `${url}/9999/member/${TestUserBrandMember.id}`,
			method: 'post',
			entity: GroupEntity,
			asAdmin: true,
		});
	});

	it('addMember should return 200 and newly added member', async () => {
		await TestIntCreateMethod({
			createObj: { ...TestGroup, userId: TestGroup.createdById },
			url: `${url}/${TestGroup.id}/member/${TestUserBrandMember.id}`,
			entity: GroupEntity,
			asMember: true,
		});
	});

	it('addMember should return 403 for already added member', async () => {
		await TestInt403Method({
			url: `${url}/${TestGroup.id}/member/${TestUserBrandMember.id}`,
			method: 'post',
			entity: GroupEntity,
			asMember: true,
			errorMessage: 'Already member',
		});
	});

	it('approveMember should return 401 for not authorized user', async () => {
		await TestInt401Method({ url: `${url}/${TestGroup.id}/member/${TestUserBrandMember.id}`, method: 'put', entity: GroupEntity });
	});

	it('approveMember should return 403 for non owner', async () => {
		await TestInt403Method({
			url: `${url}/${TestGroup.id}/member/${TestUserBrandMember.id}`,
			method: 'put',
			entity: GroupEntity,
			asAdmin: true,
		});
	});

	it('approveMember should return 404 for item that not exist', async () => {
		await TestIntUpdate404Method({
			url: `${url}/9999/member/${TestUserBrandMember.id}`,
			method: 'put',
			entity: GroupEntity,
			asAdmin: true,
		});
	});

	it('approveMember should return 200', async () => {
		await TestIntUpdateMethod({
			updateObj: {},
			url: `${url}/${TestGroup.id}/member/${TestUserBrandMember.id}`,
			entity: GroupEntity,
			asMember: true,
		});
	});

	it('deleteMember should return 401 for not authorized user', async () => {
		await TestInt401Method({ url: `${url}/${TestGroup.id}/member/${TestUserBrandMember.id}`, method: 'delete', entity: GroupEntity });
	});

	it('deleteMember should return 403 for non owner', async () => {
		await TestInt403Method({
			url: `${url}/${TestGroup.id}/member/${TestUserBrandMember.id}`,
			method: 'delete',
			entity: GroupEntity,
			asAdmin: true,
		});
	});

	it('deleteMember should return 404 for item that not exist', async () => {
		await TestIntUpdate404Method({
			url: `${url}/9999/member/${TestUserBrandMember.id}`,
			method: 'delete',
			entity: GroupEntity,
			asAdmin: true,
		});
	});

	it('deleteMember should return 200', async () => {
		await TestIntDeleteMethod({
			url: `${url}/${TestGroup.id}/member/${TestUserBrandMember.id}`,
			entity: GroupEntity,
			asMember: true,
		});
	});

	it('DELETE should throw error for not authorized user', async () => {
		await TestInt401Method({ id: TestGroup.id, url, method: 'delete', entity: GroupEntity });
	});

	it('DELETE should return 403', async () => {
		await TestInt403Method({ id: TestGroup.id, url, method: 'delete', entity: GroupEntity, asAdmin: true });
	});

	it('DELETE should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ id: 9999, method: 'delete', url, entity: GroupEntity, asSuperAdmin: true });
	});

	it('DELETE should return 200 and deleted object as owner', async () => {
		await TestIntDeleteMethod({ id: TestGroup.id, url, entity: GroupEntity, asMember: true });
	});
});
