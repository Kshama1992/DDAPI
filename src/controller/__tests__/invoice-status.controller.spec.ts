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
import { TestInvStatusInactive, TestInvStatusNew, TestInvStatusPartialRefund, TestInvStatusRefund } from '@utils/tests/base-data';
import InvoiceStatusEntity from '@entity/invoice-status.entity';

const url = '/invoice-status';

describe('ROUTE: /invoice-status', () => {
	it('POST should throw error as not authorized user', async () => {
		await TestInt401Method({ url, method: 'post', entity: InvoiceStatusEntity });
	});

	it('POST should throw error as brand admin', async () => {
		const random = getRandomTextHelper(12);
		await TestInt403Method({ url, obj: { name: `test name status ${random}` }, method: 'post', entity: InvoiceStatusEntity, asAdmin: true });
	});

	it('POST should throw error as member', async () => {
		await TestInt403Method({ url, obj: { name: 'test name status' }, method: 'post', entity: InvoiceStatusEntity, asMember: true });
	});

	it('POST should return 200 and newly created object as SuperAdmin', async () => {
		const random = getRandomTextHelper(12);
		const createObj = {
			name: `Test status created ${random}`,
		};
		await TestIntCreateMethod({ createObj, url, entity: InvoiceStatusEntity, asSuperAdmin: true });
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
		await TestInt422Method({ obj, url, method: 'post', entity: InvoiceStatusEntity, asSuperAdmin: true, expectedErrors });
	});

	it('PUT should throw error for not authorized user', async () => {
		await TestInt401Method({ id: TestInvStatusNew.id, url, method: 'put', entity: InvoiceStatusEntity });
	});

	it('PUT should throw error as brand admin', async () => {
		await TestInt403Method({
			id: TestInvStatusPartialRefund.id,
			url,
			obj: { name: 'test name admin', domain: 'test-name-admin' },
			method: 'put',
			entity: InvoiceStatusEntity,
			asAdmin: true,
		});
	});

	it('PUT should throw error as member', async () => {
		await TestInt403Method({
			id: TestInvStatusNew.id,
			url,
			obj: { name: 'test name member', domain: 'test-name-member' },
			method: 'put',
			entity: InvoiceStatusEntity,
			asMember: true,
		});
	});

	it('PUT should return 200 and updated object as super admin', async () => {
		const random = getRandomTextHelper(12);
		const updateObj = {
			name: `Test status renamed ${random}`,
		};
		await TestIntUpdateMethod({ updateObj, id: TestInvStatusRefund.id, url, entity: InvoiceStatusEntity, asSuperAdmin: true });
	});

	it('GET should throw error for not logged in users', async () => {
		await TestInt401Method({ id: TestInvStatusPartialRefund.id, url, entity: InvoiceStatusEntity });
	});

	it('GET list should throw error for non logged in user', async () => {
		await TestInt401Method({ url, entity: InvoiceStatusEntity });
	});

	it('GET should return 200 for Superadmin & single object', async () => {
		await TestIntSingleMethod({ id: TestInvStatusInactive.id, url, entity: InvoiceStatusEntity, asSuperAdmin: true });
	});

	it('GET list should return 200 for Superadmin', async () => {
		await TestIntListMethod({ url, entity: InvoiceStatusEntity, asSuperAdmin: true });
	});

	it('GET list should return 200 for member', async () => {
		await TestIntListMethod({ url, entity: InvoiceStatusEntity, asMember: true });
	});

	it('GET list should return 200 for brand admin', async () => {
		await TestIntListMethod({ url, entity: InvoiceStatusEntity, asAdmin: true });
	});

	it('DELETE should throw error for not authorized user', async () => {
		await TestInt401Method({ id: TestInvStatusPartialRefund.id, url, method: 'delete', entity: InvoiceStatusEntity });
	});

	it('DELETE should throw error as brand admin', async () => {
		await TestInt403Method({ id: TestInvStatusNew.id, url, method: 'delete', entity: InvoiceStatusEntity, asAdmin: true });
	});

	it('DELETE should throw error as member', async () => {
		await TestInt403Method({ id: TestInvStatusNew.id, url, method: 'delete', entity: InvoiceStatusEntity, asMember: true });
	});

	it('DELETE should return 200 and deleted object', async () => {
		await TestIntDeleteMethod({ id: TestInvStatusPartialRefund.id, url, entity: InvoiceStatusEntity, asSuperAdmin: true });
	});
});
