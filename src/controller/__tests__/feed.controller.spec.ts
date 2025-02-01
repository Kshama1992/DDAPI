import {
	TestInt401Method,
	TestInt422Method,
	TestIntCreateMethod,
	TestIntDeleteMethod,
	TestIntListMethod,
	TestIntSingleMethod,
	TestIntUpdate404Method,
	TestIntUpdateMethod,
} from '@controller/__tests__/base-service.spec';
import { TestFeedItem } from '@utils/tests/base-data';
import getRandomTextHelper from '@helpers/get-random-text.helper';
import FeedEntity from '@entity/feed.entity';

const url = '/feed';

describe('ROUTE: /feed', () => {
	it('GET with filter should return 200 & valid response and array', async () => {
		await TestIntListMethod({ url, entity: FeedEntity, filter: {}, asMember: true });
	});

	it('GET should return 200 for brand owner & single object', async () => {
		await TestIntSingleMethod({ id: TestFeedItem.id, url, entity: FeedEntity, asAdmin: true });
	});

	it('GET should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ method: 'get', id: 9999, url, entity: FeedEntity, asSuperAdmin: true });
	});

	it('GET single should return 401 for not authorized user', async () => {
		await TestInt401Method({ id: TestFeedItem.id, url, method: 'get', entity: FeedEntity });
	});

	it('PUT should return 200 and updated object as superadmin', async () => {
		const random = getRandomTextHelper(12);
		const updateObj = {
			name: `Test role renamed ${random}`,
		};
		await TestIntUpdateMethod({ updateObj, id: TestFeedItem.id, url, entity: FeedEntity, asSuperAdmin: true });
	});

	it('PUT should return 200 and updated object as owner', async () => {
		const random = getRandomTextHelper(12);
		const updateObj = {
			name: `Test role renamed ${random}`,
		};
		await TestIntUpdateMethod({ updateObj, id: TestFeedItem.id, url, entity: FeedEntity, asMember: true });
	});

	it('PUT should return 422 error', async () => {
		const obj = {
			message: '',
		};

		const expectedErrors = [
			{
				property: 'message',
			},
		];

		await TestInt422Method({ obj, id: TestFeedItem.id, url, method: 'put', entity: FeedEntity, asSuperAdmin: true, expectedErrors });
	});

	it('PUT should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ id: 9999, method: 'put', url, entity: FeedEntity, asSuperAdmin: true });
	});

	it('PUT should return 401 for not authorized user', async () => {
		await TestInt401Method({ id: 9999, url, method: 'put', entity: FeedEntity });
	});

	it('POST should return 200 and newly created object', async () => {
		await TestIntCreateMethod({
			createObj: { ...TestFeedItem, id: undefined },
			url,
			entity: FeedEntity,
			asSuperAdmin: true,
		});
	});

	it('POST should return 401 for not authorized user', async () => {
		await TestInt401Method({ url, method: 'post', entity: FeedEntity });
	});

	it('POST should return 422 error', async () => {
		const obj = { name: '' };
		const expectedErrors = [
			{
				property: 'message',
			},
		];

		await TestInt422Method({ obj, url, method: 'post', entity: FeedEntity, asSuperAdmin: true, expectedErrors });
	});

	it('like should return 401 for not authorized user', async () => {
		await TestInt401Method({ url: `${url}/${TestFeedItem.id}/like`, method: 'post', entity: FeedEntity });
	});

	it('like should return 404 for item that not exist', async () => {
		await TestIntUpdate404Method({
			url: `${url}/9999/like`,
			method: 'post',
			entity: FeedEntity,
			asAdmin: true,
		});
	});

	it('like should return 200', async () => {
		await TestIntCreateMethod({
			createObj: {},
			url: `${url}/${TestFeedItem.id}/like`,
			entity: FeedEntity,
			asMember: true,
		});
	});

	it('pin should return 401 for not authorized user', async () => {
		await TestInt401Method({ url: `${url}/${TestFeedItem.id}/pin`, method: 'post', entity: FeedEntity });
	});

	it('pin should return 404 for item that not exist', async () => {
		await TestIntUpdate404Method({
			url: `${url}/9999/pin`,
			method: 'post',
			entity: FeedEntity,
			asAdmin: true,
		});
	});

	it('pin should return 200', async () => {
		await TestIntCreateMethod({
			createObj: {},
			url: `${url}/${TestFeedItem.id}/pin`,
			entity: FeedEntity,
			asMember: true,
		});
	});

	it('report should return 401 for not authorized user', async () => {
		await TestInt401Method({ url: `${url}/${TestFeedItem.id}/report`, method: 'post', entity: FeedEntity });
	});

	it('report should return 404 for item that not exist', async () => {
		await TestIntUpdate404Method({
			url: `${url}/9999/report`,
			method: 'post',
			entity: FeedEntity,
			asAdmin: true,
		});
	});

	it('report should return 200', async () => {
		await TestIntCreateMethod({
			createObj: {},
			url: `${url}/${TestFeedItem.id}/report`,
			entity: FeedEntity,
			asMember: true,
		});
	});

	it('comment should return 401 for not authorized user', async () => {
		await TestInt401Method({ url: `${url}/${TestFeedItem.id}/comment`, method: 'post', entity: FeedEntity });
	});

	it('comment should return 404 for item that not exist', async () => {
		await TestIntUpdate404Method({
			obj: { comment: 'test comment' },
			url: `${url}/9999/comment`,
			method: 'post',
			entity: FeedEntity,
			asAdmin: true,
		});
	});

	it('comment should return 200', async () => {
		await TestIntCreateMethod({
			createObj: { comment: 'test comment' },
			url: `${url}/${TestFeedItem.id}/comment`,
			entity: FeedEntity,
			asMember: true,
		});
	});

	it('DELETE should throw error for not authorized user', async () => {
		await TestInt401Method({ id: TestFeedItem.id, url, method: 'delete', entity: FeedEntity });
	});

	it('DELETE should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ id: 9999, method: 'delete', url, entity: FeedEntity, asSuperAdmin: true });
	});

	it('DELETE should return 200 and deleted object as owner', async () => {
		await TestIntDeleteMethod({ id: TestFeedItem.id, url, entity: FeedEntity, asMember: true });
	});
});
