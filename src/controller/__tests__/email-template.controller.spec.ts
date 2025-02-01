import getRandomTextHelper from '@utils/helpers/get-random-text.helper';
import {
	TestInt401Method,
	TestInt403Method,
	TestInt422Method,
	TestIntCreateMethod,
	TestIntDeleteMethod,
	TestIntListMethod,
	TestIntSingleMethod,
	TestIntUpdateMethod,
} from '@controller/__tests__/base-service.spec';
import { TestEmailTemplate, TestUserBrandAdmin } from '@utils/tests/base-data';
import EmailTemplateEntity from '@entity/email-template.entity';

const url = '/email-template';

describe('ROUTE: /email-template', () => {
	it('POST should throw error as not authorized user', async () => {
		await TestInt401Method({ url, method: 'post', entity: EmailTemplateEntity });
	});

	it('POST should throw error as member', async () => {
		const createObj = {
			...TestEmailTemplate,
			fromEmail: 'test.created@mail.com',
			fromName: 'test name created',
			name: `Test status created`,
		};
		await TestInt403Method({ url, obj: createObj, method: 'post', entity: EmailTemplateEntity, asMember: true });
	});

	it('POST should return 200 and newly created object as SuperAdmin', async () => {
		const random = getRandomTextHelper(12);
		const createObj = {
			...TestEmailTemplate,
			fromEmail: 'test.created@mail.com',
			fromName: 'test name created',
			name: `Test status created ${random}`,
		};
		await TestIntCreateMethod({ createObj, url, entity: EmailTemplateEntity, asSuperAdmin: true });
	});

	it('POST should return validation error for object with empty name and return first error (empty field name)', async () => {
		const obj = {
			name: '',
		};

		const expectedErrors = [
			{
				property: 'name',
			},
		];
		await TestInt422Method({ obj, url, method: 'post', entity: EmailTemplateEntity, asSuperAdmin: true, expectedErrors });
	});

	it('PUT should throw error for not authorized user', async () => {
		await TestInt401Method({ id: TestEmailTemplate.id, url, method: 'put', entity: EmailTemplateEntity });
	});

	it('PUT should throw error as brand admin', async () => {
		await TestInt403Method({
			id: TestEmailTemplate.id,
			url,
			obj: { name: 'test name admin', domain: 'test-name-admin' },
			method: 'put',
			entity: EmailTemplateEntity,
			asAdmin: true,
		});
	});

	it('PUT should throw error as member', async () => {
		await TestInt403Method({
			id: TestEmailTemplate.id,
			url,
			obj: { name: 'test name member', domain: 'test-name-member' },
			method: 'put',
			entity: EmailTemplateEntity,
			asMember: true,
		});
	});

	it('PUT should return 200 and updated object as super admin', async () => {
		const random = getRandomTextHelper(12);
		const updateObj = {
			name: `Test status renamed ${random}`,
		};
		await TestIntUpdateMethod({ updateObj, id: TestUserBrandAdmin.brandId, url, entity: EmailTemplateEntity, asSuperAdmin: true });
	});

	it('GET should throw error for not logged in users', async () => {
		await TestInt401Method({ id: TestEmailTemplate.id, url, entity: EmailTemplateEntity });
	});

	it('GET list should throw error for non logged in user', async () => {
		await TestInt401Method({ url, entity: EmailTemplateEntity });
	});

	it('GET should return 200 for Superadmin & single object', async () => {
		await TestIntSingleMethod({ id: TestEmailTemplate.id, url, entity: EmailTemplateEntity, asSuperAdmin: true });
	});

	it('GET list should return 200 for Superadmin', async () => {
		await TestIntListMethod({ url, entity: EmailTemplateEntity, asSuperAdmin: true });
	});

	it('GET list should return 200 for member', async () => {
		await TestIntListMethod({ url, entity: EmailTemplateEntity, asMember: true });
	});

	it('GET list should return 200 for brand admin', async () => {
		await TestIntListMethod({ url, entity: EmailTemplateEntity, asAdmin: true });
	});

	it('DELETE should throw error for not authorized user', async () => {
		await TestInt401Method({ id: TestEmailTemplate.id, url, method: 'delete', entity: EmailTemplateEntity });
	});

	it('DELETE should throw error as brand admin', async () => {
		await TestInt403Method({ id: TestEmailTemplate.id, url, method: 'delete', entity: EmailTemplateEntity, asAdmin: true });
	});

	it('DELETE should throw error as member', async () => {
		await TestInt403Method({ id: TestEmailTemplate.id, url, method: 'delete', entity: EmailTemplateEntity, asMember: true });
	});

	it('DELETE should return 200 and deleted object', async () => {
		await TestIntDeleteMethod({ id: TestEmailTemplate.id, url, entity: EmailTemplateEntity, asSuperAdmin: true });
	});
});
