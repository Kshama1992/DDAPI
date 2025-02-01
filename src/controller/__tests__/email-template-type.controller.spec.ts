import getRandomTextHelper from '@utils/helpers/get-random-text.helper';
import {
	TestInt401Method,
	TestInt403Method,
	TestInt422Method,
	TestIntCreateMethod,
	TestIntListMethod,
	TestIntSingleMethod,
	TestIntUpdateMethod,
} from '@controller/__tests__/base-service.spec';
import { TestEmailTemplateType, TestUserBrandAdmin } from '@utils/tests/base-data';
import EmailTemplateTypeEntity from '@entity/email-template-type.entity';

const url = '/email-template-type';

describe('ROUTE: /email-template-type', () => {
	it('POST should throw error as not authorized user', async () => {
		await TestInt401Method({ url, method: 'post', entity: EmailTemplateTypeEntity });
	});

	it('POST should throw error as member', async () => {
		await TestInt403Method({ url, obj: { name: 'test name status' }, method: 'post', entity: EmailTemplateTypeEntity, asMember: true });
	});

	it('POST should return 200 and newly created object as SuperAdmin', async () => {
		const random = getRandomTextHelper(12);
		const createObj = {
			name: `Test type created ${random}`,
		};
		await TestIntCreateMethod({ createObj, url, entity: EmailTemplateTypeEntity, asSuperAdmin: true });
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
		await TestInt422Method({ obj, url, method: 'post', entity: EmailTemplateTypeEntity, asSuperAdmin: true, expectedErrors });
	});

	it('PUT should throw error for not authorized user', async () => {
		await TestInt401Method({ id: TestEmailTemplateType.id, url, method: 'put', entity: EmailTemplateTypeEntity });
	});

	it('PUT should throw error as brand admin', async () => {
		await TestInt403Method({
			id: TestEmailTemplateType.id,
			url,
			obj: { name: 'test type admin' },
			method: 'put',
			entity: EmailTemplateTypeEntity,
			asAdmin: true,
		});
	});

	it('PUT should throw error as member', async () => {
		await TestInt403Method({
			id: TestEmailTemplateType.id,
			url,
			obj: { name: 'test type member' },
			method: 'put',
			entity: EmailTemplateTypeEntity,
			asMember: true,
		});
	});

	it('PUT should return 200 and updated object as super admin', async () => {
		const random = getRandomTextHelper(12);
		const updateObj = {
			name: `Test type renamed ${random}`,
		};
		await TestIntUpdateMethod({ updateObj, id: TestUserBrandAdmin.brandId, url, entity: EmailTemplateTypeEntity, asSuperAdmin: true });
	});

	it('GET should throw error for not logged in users', async () => {
		await TestInt401Method({ id: TestEmailTemplateType.id, url, entity: EmailTemplateTypeEntity });
	});

	it('GET list should throw error for non logged in user', async () => {
		await TestInt401Method({ url, entity: EmailTemplateTypeEntity });
	});

	it('GET should return 200 for Superadmin & single object', async () => {
		await TestIntSingleMethod({ id: TestEmailTemplateType.id, url, entity: EmailTemplateTypeEntity, asSuperAdmin: true });
	});

	it('GET list should return 200 for Superadmin', async () => {
		await TestIntListMethod({ url, entity: EmailTemplateTypeEntity, asSuperAdmin: true });
	});

	it('GET list should return 200 for member', async () => {
		await TestIntListMethod({ url, entity: EmailTemplateTypeEntity, asMember: true });
	});

	it('GET list should return 200 for brand admin', async () => {
		await TestIntListMethod({ url, entity: EmailTemplateTypeEntity, asAdmin: true });
	});

	it('DELETE should throw error as brand admin', async () => {
		await TestInt403Method({
			id: TestEmailTemplateType.id,
			url,
			method: 'delete',
			entity: EmailTemplateTypeEntity,
			asAdmin: true,
		});
	});
});
