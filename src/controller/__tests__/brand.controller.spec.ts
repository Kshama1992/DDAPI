import getRandomTextHelper from '@utils/helpers/get-random-text.helper';
import BrandInterface from 'dd-common-blocks/dist/interface/brand.interface';
import {
	TestInt401Method,
	TestInt403Method,
	TestInt422Method,
	TestIntCreateMethod,
	TestIntDeleteMethod,
	TestIntListMethod,
	TestIntSingleMethod,
	TestIntUpdateMethod,
	TestSingleMethod,
} from '@controller/__tests__/base-service.spec';
import BrandEntity from '@entity/brand.entity';
import { TestBrand, TestBrandDelete, TestBrandSecond, TestUserBrandAdmin } from '@utils/tests/base-data';

const url = '/brand';

describe('ROUTE: /brand', () => {
	it('POST should throw error as not authorized user', async () => {
		await TestInt401Method({ url, method: 'post', entity: BrandEntity });
	});

	it('POST should throw error as brand admin', async () => {
		const random = getRandomTextHelper(12);
		await TestInt403Method({
			url,
			obj: { name: `test name admin ${random}`, domain: `test-name-admin-${random}` },
			method: 'post',
			entity: BrandEntity,
			asAdmin: true,
		});
	});

	it('POST should throw error as member', async () => {
		await TestInt403Method({
			url,
			obj: { name: 'test name member', domain: 'test-name-member' },
			method: 'post',
			entity: BrandEntity,
			asMember: true,
		});
	});

	it('POST should return 200 and newly created object as SuperAdmin', async () => {
		const random = getRandomTextHelper(12);
		const createObj = {
			name: `Test brand created ${random}`,
			domain: `test-brand-created-${random}`,
		};
		await TestIntCreateMethod({ createObj, url, entity: BrandEntity, asSuperAdmin: true });
	});

	it('POST should return validation error for object with empty name and domain and return first error (empty field name)', async () => {
		const obj: Partial<BrandInterface> = {
			name: '',
			domain: '',
		};

		const expectedErrors = [
			{
				property: 'name',
			},
		];
		await TestInt422Method({ obj, url, method: 'post', entity: BrandEntity, asSuperAdmin: true, expectedErrors });
	});

	it('PUT should return validation error for object with empty name and domain and return first error (empty field name)', async () => {
		const obj: Partial<BrandInterface> = {
			name: '',
			domain: '',
		};

		const expectedErrors = [
			{
				property: 'name',
			},
		];
		await TestInt422Method({ id: TestBrand.id, obj, url, method: 'put', entity: BrandEntity, asSuperAdmin: true, expectedErrors });
	});

	it('PUT should throw error for not authorized user', async () => {
		await TestInt401Method({ id: TestBrand.id, url, method: 'put', entity: BrandEntity });
	});

	it('PUT should throw error as brand admin', async () => {
		await TestInt403Method({
			id: TestBrandSecond.id,
			url,
			obj: { name: 'test name admin', domain: 'test-name-admin' },
			method: 'put',
			entity: BrandEntity,
			asAdmin: true,
		});
	});

	it('PUT should throw error as member', async () => {
		await TestInt403Method({
			id: TestBrand.id,
			url,
			obj: { name: 'test name member', domain: 'test-name-member' },
			method: 'put',
			entity: BrandEntity,
			asMember: true,
		});
	});

	it('PUT should return 200 and updated object', async () => {
		const random = getRandomTextHelper(12);
		const updateObj = {
			name: `Test brand renamed ${random}`,
			domain: `test-brand-renamed-${random}`,
		};
		await TestIntUpdateMethod({ updateObj, id: TestUserBrandAdmin.brandId, url, entity: BrandEntity, asSuperAdmin: true });
	});

	it('GET should throw error for not logged in users', async () => {
		await TestInt401Method({ id: TestBrandSecond.id, url, entity: BrandEntity });
	});

	it('GET should throw error for members', async () => {
		await TestInt403Method({ id: TestBrandSecond.id, url, entity: BrandEntity, asMember: true });
	});

	it('GET should throw error for others brand admin', async () => {
		await TestInt403Method({ id: TestBrandSecond.id, url, entity: BrandEntity, asAdmin: true });
	});

	it('GET with filter should return 200 & valid response and array', async () => {
		await TestIntListMethod({ url, entity: BrandEntity, filter: { domain: 'test', limit: 100 } });
	});

	it('GET should return 200 for brand owner & single object', async () => {
		await TestIntSingleMethod({ id: TestUserBrandAdmin.brandId, url, entity: BrandEntity, asAdmin: true });
	});

	it('GET should return 200 for Superadmin & single object', async () => {
		await TestIntSingleMethod({ id: TestBrandSecond.id, url, entity: BrandEntity, asSuperAdmin: true });
	});

	it('DELETE should throw error for not authorized user', async () => {
		await TestInt401Method({ id: TestBrand.id, url, method: 'delete', entity: BrandEntity });
	});

	it('DELETE should throw error as brand admin', async () => {
		await TestInt403Method({ id: TestBrand.id, url, method: 'delete', entity: BrandEntity, asAdmin: true });
	});

	it('DELETE should throw error as member', async () => {
		await TestInt403Method({ id: TestBrand.id, url, method: 'delete', entity: BrandEntity, asMember: true });
	});

	it('DELETE should return 200 and deleted object', async () => {
		await TestIntDeleteMethod({ id: TestBrandDelete.id, url, entity: BrandEntity, asSuperAdmin: true });
	});

	it('GET should throw error for Unauthorized', async () => {
		await TestInt401Method({ id: TestBrand.id, url, entity: BrandEntity, asSuperAdmin: false });
	});

    it('GET should return 200 for get brand', async () => {
		await TestSingleMethod({ url, entity: BrandEntity, asSuperAdmin: true });
	});

    it('GET should return 200 for Superadmin & single object', async () => {
        const url = '/brand/default-brand';
		await TestSingleMethod({url, entity: BrandEntity, asSuperAdmin: true });
	});

});
