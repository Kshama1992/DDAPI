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
import { TestCompany, TestUserBrandMember } from '@utils/tests/base-data';
import getRandomTextHelper from '@helpers/get-random-text.helper';
import CompanyEntity from '@entity/company.entity';

const url = '/company';

describe('ROUTE: /company', () => {
	it('GET with filter should return 200 & valid response and array', async () => {
		await TestIntListMethod({ url, entity: CompanyEntity, filter: {}, asMember: true });
	});

	it('GET should return 200 for brand owner & single object', async () => {
		await TestIntSingleMethod({ id: TestCompany.id, url, entity: CompanyEntity, asAdmin: true });
	});

	it('GET should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ method: 'get', id: 9999, url, entity: CompanyEntity, asSuperAdmin: true });
	});

	it('GET single should return 401 for not authorized user', async () => {
		await TestInt401Method({ id: TestCompany.id, url, method: 'get', entity: CompanyEntity });
	});

	it('PUT should return 200 and updated object as superadmin', async () => {
		const random = getRandomTextHelper(12);
		const updateObj = {
			name: `Test role renamed ${random}`,
		};
		await TestIntUpdateMethod({ updateObj, id: TestCompany.id, url, entity: CompanyEntity, asSuperAdmin: true });
	});

	it('PUT should return 200 and updated object as owner', async () => {
		const random = getRandomTextHelper(12);
		const updateObj = {
			name: `Test role renamed ${random}`,
		};
		await TestIntUpdateMethod({ updateObj, id: TestCompany.id, url, entity: CompanyEntity, asMember: true });
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

		await TestInt422Method({ obj, id: TestCompany.id, url, method: 'put', entity: CompanyEntity, asSuperAdmin: true, expectedErrors });
	});

	it('PUT should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ id: 9999, method: 'put', url, entity: CompanyEntity, asSuperAdmin: true });
	});

	it('PUT should return 401 for not authorized user', async () => {
		await TestInt401Method({ id: 9999, url, method: 'put', entity: CompanyEntity });
	});

	it('POST should return 200 and newly created object', async () => {
		await TestIntCreateMethod({
			createObj: { ...TestCompany, userId: TestCompany.createdById },
			url,
			entity: CompanyEntity,
			asSuperAdmin: true,
		});
	});

	it('POST should return 401 for not authorized user', async () => {
		await TestInt401Method({ url, method: 'post', entity: CompanyEntity });
	});

	it('POST should return 422 error', async () => {
		const obj = { name: '' };
		const expectedErrors = [
			{
				property: 'name',
			},
		];

		await TestInt422Method({ obj, url, method: 'post', entity: CompanyEntity, asSuperAdmin: true, expectedErrors });
	});

	it('addMember should return 401 for not authorized user', async () => {
		await TestInt401Method({ url: `${url}/${TestCompany.id}/member/${TestUserBrandMember.id}`, method: 'post', entity: CompanyEntity });
	});

	it('addMember should return 403 for non owner', async () => {
		await TestInt403Method({
			url: `${url}/${TestCompany.id}/member/${TestUserBrandMember.id}`,
			method: 'post',
			entity: CompanyEntity,
			asAdmin: true,
		});
	});

	it('addMember should return 404 for company that not exist', async () => {
		await TestIntUpdate404Method({
			url: `${url}/9999/member/${TestUserBrandMember.id}`,
			method: 'post',
			entity: CompanyEntity,
			asAdmin: true,
		});
	});

	it('addMember should return 200 and newly added member', async () => {
		await TestIntCreateMethod({
			createObj: { ...TestCompany, userId: TestCompany.createdById },
			url: `${url}/${TestCompany.id}/member/${TestUserBrandMember.id}`,
			entity: CompanyEntity,
			asMember: true,
		});
	});

	it('addMember should return 403 for already added member', async () => {
		await TestInt403Method({
			url: `${url}/${TestCompany.id}/member/${TestUserBrandMember.id}`,
			method: 'post',
			entity: CompanyEntity,
			asMember: true,
			errorMessage: 'Already member',
		});
	});

	it('approveMember should return 401 for not authorized user', async () => {
		await TestInt401Method({ url: `${url}/${TestCompany.id}/member/${TestUserBrandMember.id}`, method: 'put', entity: CompanyEntity });
	});

	it('approveMember should return 403 for non owner', async () => {
		await TestInt403Method({
			url: `${url}/${TestCompany.id}/member/${TestUserBrandMember.id}`,
			method: 'put',
			entity: CompanyEntity,
			asAdmin: true,
		});
	});

	it('approveMember should return 404 for company that not exist', async () => {
		await TestIntUpdate404Method({
			url: `${url}/9999/member/${TestUserBrandMember.id}`,
			method: 'put',
			entity: CompanyEntity,
			asAdmin: true,
		});
	});

	it('approveMember should return 200', async () => {
		await TestIntUpdateMethod({
			updateObj: {},
			url: `${url}/${TestCompany.id}/member/${TestUserBrandMember.id}`,
			entity: CompanyEntity,
			asMember: true,
		});
	});

	it('deleteMember should return 401 for not authorized user', async () => {
		await TestInt401Method({ url: `${url}/${TestCompany.id}/member/${TestUserBrandMember.id}`, method: 'delete', entity: CompanyEntity });
	});

	it('deleteMember should return 403 for non owner', async () => {
		await TestInt403Method({
			url: `${url}/${TestCompany.id}/member/${TestUserBrandMember.id}`,
			method: 'delete',
			entity: CompanyEntity,
			asAdmin: true,
		});
	});

	it('deleteMember should return 404 for company that not exist', async () => {
		await TestIntUpdate404Method({
			url: `${url}/9999/member/${TestUserBrandMember.id}`,
			method: 'delete',
			entity: CompanyEntity,
			asAdmin: true,
		});
	});

	it('deleteMember should return 200', async () => {
		await TestIntDeleteMethod({
			url: `${url}/${TestCompany.id}/member/${TestUserBrandMember.id}`,
			entity: CompanyEntity,
			asMember: true,
		});
	});

	it('DELETE should throw error for not authorized user', async () => {
		await TestInt401Method({ id: TestCompany.id, url, method: 'delete', entity: CompanyEntity });
	});

	it('DELETE should return 403', async () => {
		await TestInt403Method({ id: TestCompany.id, url, method: 'delete', entity: CompanyEntity, asAdmin: true });
	});

	it('DELETE should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ id: 9999, method: 'delete', url, entity: CompanyEntity, asSuperAdmin: true });
	});

	it('DELETE should return 200 and deleted object as owner', async () => {
		await TestIntDeleteMethod({ id: TestCompany.id, url, entity: CompanyEntity, asMember: true });
	});
});
