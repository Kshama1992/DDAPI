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
import { TestFeedCategory, TestUserBrandAdmin } from '@utils/tests/base-data';
import FeedCategoryEntity from '@entity/feed-category.entity';

const url = '/feed-category';

describe('ROUTE: /feed-category', () => {
	it('POST should throw error as not authorized user', async () => {
		await TestInt401Method({ url, method: 'post', entity: FeedCategoryEntity });
	});

	it('POST should throw error as member', async () => {
		await TestInt403Method({ url, obj: { name: 'test name status' }, method: 'post', entity: FeedCategoryEntity, asMember: true });
	});

	it('POST should return 200 and newly created object as SuperAdmin', async () => {
		const random = getRandomTextHelper(12);
		const createObj = {
			...TestFeedCategory,
			id: undefined,
			name: `Test created ${random}`,
		};
		await TestIntCreateMethod({ createObj, url, entity: FeedCategoryEntity, asSuperAdmin: true });
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
		await TestInt422Method({ obj, url, method: 'post', entity: FeedCategoryEntity, asSuperAdmin: true, expectedErrors });
	});

	it('PUT should throw error for not authorized user', async () => {
		await TestInt401Method({ id: TestFeedCategory.id, url, method: 'put', entity: FeedCategoryEntity });
	});

	it('PUT should throw error as brand admin', async () => {
		await TestInt403Method({
			id: TestFeedCategory.id,
			url,
			obj: { name: 'test admin' },
			method: 'put',
			entity: FeedCategoryEntity,
			asAdmin: true,
		});
	});

	it('PUT should throw error as member', async () => {
		await TestInt403Method({
			id: TestFeedCategory.id,
			url,
			obj: { name: 'test member' },
			method: 'put',
			entity: FeedCategoryEntity,
			asMember: true,
		});
	});

	it('PUT should return 200 and updated object as super admin', async () => {
		const random = getRandomTextHelper(12);
		const updateObj = {
			name: `Test type renamed ${random}`,
		};
		await TestIntUpdateMethod({ updateObj, id: TestUserBrandAdmin.brandId, url, entity: FeedCategoryEntity, asSuperAdmin: true });
	});

	it('GET should throw error for not logged in users', async () => {
		await TestInt401Method({ id: TestFeedCategory.id, url, entity: FeedCategoryEntity });
	});

	it('GET list should throw error for non logged in user', async () => {
		await TestInt401Method({ url, entity: FeedCategoryEntity });
	});

	it('GET should return 200 for Superadmin & single object', async () => {
		await TestIntSingleMethod({ id: TestFeedCategory.id, url, entity: FeedCategoryEntity, asSuperAdmin: true });
	});

	it('GET list should return 200 for Superadmin', async () => {
		await TestIntListMethod({ url, entity: FeedCategoryEntity, asSuperAdmin: true });
	});

	it('GET list should return 200 for member', async () => {
		await TestIntListMethod({ url, entity: FeedCategoryEntity, asMember: true });
	});

	it('GET list should return 200 for brand admin', async () => {
		await TestIntListMethod({ url, entity: FeedCategoryEntity, asAdmin: true });
	});

	it('DELETE should throw error as brand admin', async () => {
		await TestInt403Method({ id: TestFeedCategory.id, url, method: 'delete', entity: FeedCategoryEntity, asAdmin: true });
	});
});
