import {
	TestInt401Method,
	TestInt403Method,
	TestInt422Method,
	TestIntDeleteMethod,
	TestIntUpdate404Method,
	TestIntUpdateMethod,
} from '@controller/__tests__/base-service.spec';
import { TestSpaceMonthlySecond, TestSubscription, TestUserBrandMember } from '@utils/tests/base-data';
import getRandomTextHelper from '@helpers/get-random-text.helper';
import SubscriptionEntity from '@entity/subscription.entity';
import MainDataSource from '@src/main-data-source';

const url = '/subscription';

beforeAll(async () => {
	await MainDataSource.getRepository(SubscriptionEntity).save(
		MainDataSource.getRepository(SubscriptionEntity).create({
			name: 'some test name',
			startDate: new Date(),
			endDate: new Date(),
			userId: TestUserBrandMember.id,
			createdById: TestUserBrandMember.id,
			brandId: TestUserBrandMember.brandId,
			spaceId: TestSpaceMonthlySecond.id,
			venueId: TestSpaceMonthlySecond.venueId,
		})
	);
});

describe('ROUTE: /subscription', () => {
	it('GET LIST should return 403', async () => {
		await TestInt403Method({ url, entity: SubscriptionEntity, asSuperAdmin: true });
	});

	it('PUT should return 200 and updated object', async () => {
		const random = getRandomTextHelper(12);
		const updateObj = {
			name: `Test renamed ${random}`,
		};
		await TestIntUpdateMethod({ updateObj, id: TestSubscription.id, url, entity: SubscriptionEntity, asSuperAdmin: true });
	});

	it('PUT should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ id: 9999, method: 'put', obj: TestSubscription, url, entity: SubscriptionEntity, asSuperAdmin: true });
	});

	it('PUT should return 401 for not authorized user', async () => {
		await TestInt401Method({ id: 9999, url, method: 'put', entity: SubscriptionEntity });
	});

	// TODO: fix me after invoices covered
	// it('POST should return 200 and newly created object', async () => {
	// 	await TestIntCreateMethod<SubscriptionEntity>({ createObj: TestSubscription, url, entity: SubscriptionEntity, asSuperAdmin: true });
	// });

	it('POST should return 401 for not authorized user', async () => {
		await TestInt401Method({ url, method: 'post', entity: SubscriptionEntity });
	});

	it('POST should return 422 error', async () => {
		const obj = { name: '' };
		const expectedErrors = [
			{
				property: 'name',
			},
		];

		await TestInt422Method({ obj, url, method: 'post', entity: SubscriptionEntity, asSuperAdmin: true, expectedErrors });
	});

	it('DELETE should throw error for not authorized user', async () => {
		await TestInt401Method({ id: TestSubscription.id, url, method: 'delete', entity: SubscriptionEntity });
	});

	it('DELETE should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ id: 9999, method: 'delete', url, entity: SubscriptionEntity, asSuperAdmin: true });
	});

	it('DELETE should return 200 and deleted object', async () => {
		await TestIntDeleteMethod({ id: TestSubscription.id, url, entity: SubscriptionEntity, asSuperAdmin: true });
	});
});
