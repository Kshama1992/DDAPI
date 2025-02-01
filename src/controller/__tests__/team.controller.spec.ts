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
import { TestTeam, TestUserBrandMember, TestUserBrandAdminSecond } from '@utils/tests/base-data';
import getRandomTextHelper from '@helpers/get-random-text.helper';
import TeamEntity from '@src/entity/team.entity';
import MainDataSource from '@src/main-data-source';
// import TeamMemberEntity from '@entity/team-member.entity';

const url = '/team';

beforeAll(async () => {
	await MainDataSource.getRepository(TeamEntity).save([MainDataSource.getRepository(TeamEntity).create(TestTeam)]);
});

describe('ROUTE: /team', () => {
	it('GET with filter should return 200 & valid response and array', async () => {
		await TestIntListMethod({ url, entity: TeamEntity, filter: {}, asMember: true });
	});

	// it('GET listMembers with filter should return 200 & valid response and array', async () => {
	// 	await TestIntListMethod({ url: `${url}/${TestTeam.id}/member`, entity: TeamMemberEntity, filter: {}, asMember: true });
	// });

	it('GET should return 200 for brand owner & single object', async () => {
		await TestIntSingleMethod({ id: TestTeam.id, url, entity: TeamEntity, asAdmin: true });
	});

	it('GET should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ method: 'get', id: 9999, url, entity: TeamEntity, asSuperAdmin: true });
	});

	it('PUT should return 200 and updated object as superadmin', async () => {
		const random = getRandomTextHelper(12);
		const updateObj = {
			name: `Test renamed ${random}`,
		};
		await TestIntUpdateMethod({ updateObj, id: TestTeam.id, url, entity: TeamEntity, asSuperAdmin: true });
	});

	it('PUT should return 200 and updated object as owner', async () => {
		const random = getRandomTextHelper(12);
		const updateObj = {
			name: `Test renamed ${random}`,
		};
		await TestIntUpdateMethod({ updateObj, id: TestTeam.id, url, entity: TeamEntity, asMember: true });
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

		await TestInt422Method({ obj, id: TestTeam.id, url, method: 'put', entity: TeamEntity, asSuperAdmin: true, expectedErrors });
	});

	it('PUT should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ id: 9999, method: 'put', url, entity: TeamEntity, asSuperAdmin: true });
	});

	it('PUT should return 401 for not authorized user', async () => {
		await TestInt401Method({ id: 9999, url, method: 'put', entity: TeamEntity });
	});

	it('POST should return 200 and newly created object', async () => {
		await TestIntCreateMethod({
			createObj: { ...TestTeam, id: undefined },
			url,
			entity: TeamEntity,
			asMember: true,
		});
	});

	it('POST should return 401 for not authorized user', async () => {
		await TestInt401Method({ url, method: 'post', entity: TeamEntity });
	});

	it('POST should return 422 error', async () => {
		const obj = { name: '' };
		const expectedErrors = [
			{
				property: 'name',
			},
		];

		await TestInt422Method({ obj, url, method: 'post', entity: TeamEntity, asSuperAdmin: true, expectedErrors });
	});

	it('addMember should return 401 for not authorized user', async () => {
		await TestInt401Method({ url: `${url}/${TestTeam.id}/member/${TestUserBrandMember.id}`, method: 'post', entity: TeamEntity });
	});

	it('addMember should return 404 for company that not exist', async () => {
		await TestIntUpdate404Method({
			url: `${url}/9999/member/${TestUserBrandMember.id}`,
			method: 'post',
			entity: TeamEntity,
			asMember: true,
		});
	});

	it('addMember should return 200 and newly added member', async () => {
		await TestIntCreateMethod({
			createObj: {},
			url: `${url}/${TestTeam.id}/member/${TestUserBrandAdminSecond.id}`,
			entity: TeamEntity,
			asMember: true,
		});
	});

	it('addMember should return 403 for already added member', async () => {
		await TestInt403Method({
			url: `${url}/${TestTeam.id}/member/${TestUserBrandAdminSecond.id}`,
			method: 'post',
			entity: TeamEntity,
			asMember: true,
			errorMessage: 'Already member',
		});
	});

	it('deleteMember should return 401 for not authorized user', async () => {
		await TestInt401Method({ url: `${url}/${TestTeam.id}/member/${TestUserBrandMember.id}`, method: 'delete', entity: TeamEntity });
	});

	it('deleteMember should return 403 for non owner', async () => {
		await TestInt403Method({
			url: `${url}/${TestTeam.id}/member/${TestUserBrandMember.id}`,
			method: 'delete',
			entity: TeamEntity,
			asAdmin: true,
		});
	});

	it('deleteMember should return 404 for company that not exist', async () => {
		await TestIntUpdate404Method({
			url: `${url}/9999/member/${TestUserBrandMember.id}`,
			method: 'delete',
			entity: TeamEntity,
			asAdmin: true,
		});
	});

	it('deleteMember should return 200', async () => {
		await TestIntDeleteMethod({
			url: `${url}/${TestTeam.id}/member/${TestUserBrandAdminSecond.id}`,
			entity: TeamEntity,
			asMember: true,
		});
	});

	it('DELETE should throw error for not authorized user', async () => {
		await TestInt401Method({ id: TestTeam.id, url, method: 'delete', entity: TeamEntity });
	});

	it('DELETE should return 403', async () => {
		await TestInt403Method({ id: TestTeam.id, url, method: 'delete', entity: TeamEntity, asAdmin: true });
	});

	it('DELETE should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ id: 9999, method: 'delete', url, entity: TeamEntity, asSuperAdmin: true });
	});

	it('DELETE should return 200 and deleted object as owner', async () => {
		await TestIntDeleteMethod({ id: TestTeam.id, url, entity: TeamEntity, asMember: true });
	});
});
