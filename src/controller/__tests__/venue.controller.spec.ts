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
import getRandomTextHelper from '@helpers/get-random-text.helper';
import { TestVenue, TestVenueSecond, TestVenueDeleted } from '@utils/tests/base-data';
import VenueEntity from '@entity/venue.entity';

const url = '/venue';

describe(`ROUTE: /venue`, () => {
	it('POST should throw error as not authorized user', async () => {
		await TestInt401Method({ url, method: 'post', entity: VenueEntity });
	});

	it('POST should return 200 and newly created object as brand admin', async () => {
		const random = getRandomTextHelper(12);
		await TestIntCreateMethod({
			url,
			createObj: { ...TestVenueSecond, id: undefined, name: `test name venue ${random}`, alias: `test-name-venue-${random}` },
			entity: VenueEntity,
			asAdmin: true,
		});
	});

	it('POST should throw error as member', async () => {
		await TestInt403Method({
			url,
			obj: { ...TestVenueSecond, id: undefined, name: 'test name venue', domain: 'test-name-venue' },
			method: 'post',
			entity: VenueEntity,
			asMember: true,
		});
	});

	it('POST should return 200 and newly created object as SuperAdmin', async () => {
		const random = getRandomTextHelper(12);
		const createObj = {
			...TestVenueSecond,
			id: undefined,
			name: `Test venue created ${random}`,
			domain: `test-venue-created-${random}`,
		};
		await TestIntCreateMethod({ createObj, url, entity: VenueEntity, asSuperAdmin: true });
	});

	it('POST should return validation error for object with empty name and domain and return first error (empty field name)', async () => {
		const obj = {
			name: '',
		};

		const expectedErrors = [
			{
				property: 'name',
			},
		];
		await TestInt422Method({ obj, url, method: 'post', entity: VenueEntity, asSuperAdmin: true, expectedErrors });
	});

	it('PUT should return validation error for object with empty name and domain and return first error (empty field name)', async () => {
		const obj = {
			name: '',
		};

		const expectedErrors = [
			{
				property: 'name',
			},
		];
		await TestInt422Method({ id: TestVenue.id, obj, url, method: 'put', entity: VenueEntity, asSuperAdmin: true, expectedErrors });
	});

	it('PUT should throw error for not authorized user', async () => {
		await TestInt401Method({ id: TestVenue.id, url, method: 'put', entity: VenueEntity });
	});

	it('PUT should throw error as brand admin', async () => {
		await TestInt403Method({
			id: TestVenueSecond.id,
			url,
			obj: { name: 'test name venue' },
			method: 'put',
			entity: VenueEntity,
			asAdmin: true,
		});
	});

	it('PUT should throw error when editing deleted venue', async () => {
		await TestInt403Method({
			id: TestVenueDeleted.id,
			url,
			obj: { name: 'test name venue' },
			method: 'put',
			entity: VenueEntity,
			asSuperAdmin: true,
			errorMessage: 'Venue deleted. No edit allowed.',
		});
	});

	it('PUT should throw error as member', async () => {
		await TestInt403Method({ id: TestVenue.id, url, obj: { name: 'test name venue' }, method: 'put', entity: VenueEntity, asMember: true });
	});

	it('PUT should throw error as others brand admin', async () => {
		await TestInt403Method({ id: TestVenueSecond.id, url, obj: { name: 'test name venue' }, method: 'put', entity: VenueEntity, asAdmin: true });
	});

	it('PUT should return 200 and updated object as super admin', async () => {
		const random = getRandomTextHelper(12);
		const updateObj = {
			name: `Test brand renamed ${random}`,
			domain: `test-brand-renamed-${random}`,
		};
		await TestIntUpdateMethod({ updateObj, id: TestVenue.id, url, entity: VenueEntity, asSuperAdmin: true });
	});

	it('PUT should return 200 and updated object as same brand admin', async () => {
		const random = getRandomTextHelper(12);
		const updateObj = {
			name: `Test brand renamed ${random}`,
			domain: `test-brand-renamed-${random}`,
		};
		await TestIntUpdateMethod({ updateObj, id: TestVenue.id, url, entity: VenueEntity, asAdmin: true });
	});

	it('PUT should return 200 and updated object as owner', async () => {
		const random = getRandomTextHelper(12);
		const updateObj = {
			name: `Test brand renamed ${random}`,
			domain: `test-brand-renamed-${random}`,
		};
		await TestIntUpdateMethod({ updateObj, id: TestVenue.id, url, entity: VenueEntity, asAdmin: true });
	});

	it('GET with filter should return 200 & valid response and array', async () => {
		await TestIntListMethod({ url, entity: VenueEntity, filter: { limit: 100 } });
	});

	it('GET should return 200 for brand owner & single object', async () => {
		await TestIntSingleMethod({ id: TestVenue.id, url, entity: VenueEntity, asAdmin: true });
	});

	it('GET should return 200 for Superadmin & single object', async () => {
		await TestIntSingleMethod({ id: TestVenueSecond.id, url, entity: VenueEntity, asSuperAdmin: true });
	});

	it('DELETE should throw error for not authorized user', async () => {
		await TestInt401Method({ id: TestVenue.id, url, method: 'delete', entity: VenueEntity });
	});

	it('DELETE should throw error as member', async () => {
		await TestInt403Method({ id: TestVenue.id, url, method: 'delete', entity: VenueEntity, asMember: true });
	});

	it('DELETE should return 200 and deleted object', async () => {
		await TestIntDeleteMethod({ id: TestVenue.id, url, entity: VenueEntity, asSuperAdmin: true });
	});
});
