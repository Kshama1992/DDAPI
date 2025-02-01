import getRandomTextHelper from '@utils/helpers/get-random-text.helper';
import {
	getRequest,
	TestInt401Method,
	TestInt403Method,
	TestInt422Method,
	TestIntCreateMethod,
	TestIntDeleteMethod,
	TestIntListMethod,
	// TestIntSingleMethod,
	TestIntUpdateMethod,
} from '@controller/__tests__/base-service.spec';
import { faker } from '@faker-js/faker';
import {
	TestBrand,
	TestSpaceDropIn,
	TestSpaceMonthly,
	TestSpaceMonthlySecond,
	TestSpaceType,
	TestUserBrandMember,
	TestVenue,
} from '@utils/tests/base-data';
import request from 'supertest';
import SpaceEntity from '@src/entity/space.entity';
import MainDataSource from '@src/main-data-source';
import { generateSlug } from 'dd-common-blocks';
import VenueEntity from '@entity/venue.entity';
import type SpaceFilterRequest from '@src/dto/space-filter-request';
import BrandEntity from '@entity/brand.entity';
import SpaceTypeEntity from '@entity/space-type.entity';
import SpaceTypeLogicType from 'dd-common-blocks/dist/type/SpaceTypeLogicType';
import ChargeType from 'dd-common-blocks/dist/type/ChargeType';
import SpaceStatus from 'dd-common-blocks/dist/type/SpaceStatus';
import PackageShow from 'dd-common-blocks/dist/type/PackageShow';
import { app } from '../../../jest.setup.env';

const url = '/space';

describe('ROUTE: /space', () => {
	it('POST should throw error as not authorized user', async () => {
		await TestInt401Method({ url, method: 'post', entity: SpaceEntity });
	});

	it('POST should throw error as member', async () => {
		await TestInt403Method({ url, obj: { ...TestSpaceMonthly, name: 'test name' }, method: 'post', entity: SpaceEntity, asMember: true });
	});

	it('POST should return 200 and newly created object as Brand admin', async () => {
		const random = getRandomTextHelper(12);
		const createObj = {
			...TestSpaceMonthly,
			id: undefined,
			name: `Test name created brand admin ${random}`,
		};
		await TestIntCreateMethod({ createObj, url, entity: SpaceEntity, asAdmin: true });
	});

	it('POST should return 200 and newly created object as SuperAdmin', async () => {
		const random = getRandomTextHelper(12);
		const createObj = {
			...TestSpaceMonthly,
			id: undefined,
			name: `Test name created superadmin ${random}`,
		};
		await TestIntCreateMethod({ createObj, url, entity: SpaceEntity, asSuperAdmin: true });
	});

	it('POST should return validation error for object with empty name and return first error (empty field name)', async () => {
		const obj = {
			...TestSpaceMonthly,
			name: '',
		};

		const expectedErrors = [
			{
				property: 'name',
			},
		];
		await TestInt422Method({ obj, url, method: 'post', entity: SpaceEntity, asSuperAdmin: true, expectedErrors });
	});

	it('PUT should throw error for not authorized user', async () => {
		await TestInt401Method({ id: TestSpaceMonthlySecond.id, url, method: 'put', entity: SpaceEntity });
	});

	it('PUT should throw error as other brand admin', async () => {
		await TestInt403Method({
			id: TestSpaceMonthlySecond.id,
			url,
			obj: { name: 'test name admin' },
			method: 'put',
			entity: SpaceEntity,
			asAdmin: true,
		});
	});

	it('PUT should throw error as member', async () => {
		await TestInt403Method({
			id: TestSpaceMonthly.id,
			url,
			obj: { name: 'test name member' },
			method: 'put',
			entity: SpaceEntity,
			asMember: true,
		});
	});

	it('PUT should return 200 and updated object as super admin', async () => {
		const random = getRandomTextHelper(12);
		const updateObj = {
			name: `Test name renamed super admin ${random}`,
		};
		await TestIntUpdateMethod({ updateObj, id: TestSpaceMonthly.id, url, entity: SpaceEntity, asSuperAdmin: true });
	});

	// it('GET should return 200', async () => {
	// 	await TestIntSingleMethod({ id: TestSpaceMonthly.id, url, entity: SpaceEntity });
	// });

	it('GET getSpaceAvailability should return 200', async () => {
		const { body, statusCode } = await getRequest({
			url: `${url}/${TestSpaceDropIn.id}/availability?userId=${TestUserBrandMember.id}`,
			entity: SpaceEntity,
			asMember: true,
		});
		// const { body, statusCode } = await request(app.app).get(`${url}/${TestSpaceDropIn.id}/availability`);
		expect(statusCode).toBe(200);
		expect(body.code).toBe(200);

		expect(body).toEqual(
			expect.objectContaining({
				data: expect.arrayContaining([
					expect.objectContaining({
						date: expect.any(String),
						from: expect.any(String),
						to: expect.any(String),
						open: expect.any(Boolean),
						reserved: expect.any(Boolean),
						items: expect.any(Array),
					}),
				]),
				code: 200,
				status: 'success',
			})
		);
	});

	it('DELETE should throw error for not authorized user', async () => {
		await TestInt401Method({ id: TestSpaceMonthly.id, url, method: 'delete', entity: SpaceEntity });
	});

	it('DELETE should throw error as other brand admin', async () => {
		await TestInt403Method({ id: TestSpaceMonthlySecond.id, url, method: 'delete', entity: SpaceEntity, asAdmin: true });
	});

	it('DELETE should throw error as member', async () => {
		await TestInt403Method({ id: TestSpaceMonthly.id, url, method: 'delete', entity: SpaceEntity, asMember: true });
	});

	it('DELETE should return 200 and deleted object as owner', async () => {
		await TestIntDeleteMethod({ id: TestSpaceMonthly.id, url, entity: SpaceEntity, asAdmin: true });
	});

	it('GET listPins should return 200', async () => {
		const { body, statusCode } = await request(app.app).get(`${url}/list-pins`);
		expect(statusCode).toBe(200);
		expect(body.code).toBe(200);

		expect(body).toEqual(
			expect.objectContaining({
				data: expect.arrayContaining([
					expect.objectContaining({
						id: expect.any(Number),
						name: expect.any(String),
						alias: expect.any(String),
						address: expect.any(String),
						address2: expect.any(String),
						spaceCount: expect.any(Number),
						coordinates: {
							type: expect.any(String),
							coordinates: expect.any(Array),
						},
						photos: expect.any(Array),
					}),
				]),
				code: 200,
				status: 'success',
			})
		);
	});

	describe('Space List', () => {
		let venueIds: number[] = [];
		let brandIds: number[] = [];
		let spaceTypeIds: number[] = [];
		const itemsToGenerate = 100;

		beforeAll(async () => {
			// TODO: move entity generation to other place
			const spaceTypes = [...Array(itemsToGenerate)].map(() => {
				const name = faker.random.words(7);
				const logicTypes = Object.values(SpaceTypeLogicType);

				return {
					...TestSpaceType,
					id: undefined,
					name,
					alias: generateSlug(name),
					logicType: logicTypes[Math.floor(Math.random() * logicTypes.length)],
				};
			});
			const newSpaceTypes: SpaceTypeEntity[] = await MainDataSource.getRepository(SpaceTypeEntity).save(spaceTypes);
			spaceTypeIds = newSpaceTypes.map((v) => v.id);

			const brands = [...Array(itemsToGenerate)].map(() => {
				const name = faker.random.words(7);

				return {
					...TestBrand,
					id: undefined,
					name,
					domain: generateSlug(name),
				};
			});
			const newBrands: BrandEntity[] = await MainDataSource.getRepository(BrandEntity).save(brands);
			brandIds = newBrands.map((v) => v.id);

			const venues = [...Array(itemsToGenerate)].map(() => {
				const name = faker.random.words(7);

				return {
					...TestVenue,
					id: undefined,
					name,
					brandId: newBrands[Math.floor(Math.random() * itemsToGenerate)].id,
					address: faker.address.streetAddress(),
					email: faker.internet.email(),
				};
			});

			const newVenues: VenueEntity[] = await MainDataSource.getRepository(VenueEntity).save(venues);
			venueIds = newVenues.map((v) => v.id);

			const spaces = [...Array(itemsToGenerate)].map(() => {
				const name = faker.random.words(7);

				const packageShows = Object.values(PackageShow);
				const chargeTypes = Object.values(ChargeType);
				const statuses = Object.values(SpaceStatus);

				return {
					...TestSpaceMonthly,
					amenities: [],
					creditHours: [],
					id: undefined,
					name,
					capacity: Number(faker.random.numeric(1)),
					quantity: Number(faker.random.numeric(1)),
					price: Number(faker.random.numeric(2)),
					alias: generateSlug(name),
					spaceTypeId: spaceTypeIds[Math.floor(Math.random() * itemsToGenerate)],
					venueId: venueIds[Math.floor(Math.random() * itemsToGenerate)],
					chargeType: chargeTypes[Math.floor(Math.random() * chargeTypes.length)],
					status: statuses[Math.floor(Math.random() * statuses.length)],
					packageShow: packageShows[Math.floor(Math.random() * packageShows.length)],
				};
			});
			await MainDataSource.getRepository(SpaceEntity).save(spaces);
		});

		it('GET with filter should return 200 & valid response and array', async () => {
			await TestIntListMethod({ url, entity: SpaceEntity, filter: { limit: 10 } });
		});

		it('should list spaces only with venue id from params as not logged in user', async () => {
			const queryParams: SpaceFilterRequest = { limit: 100, venueId: venueIds[Math.floor(Math.random() * itemsToGenerate)] };
			let r = getRequest({ url, entity: SpaceEntity }).query(queryParams);
			const { body } = await r;
			expect(body.data).toEqual(expect.not.arrayContaining([expect.not.objectContaining({ venueId: queryParams.venueId })]));
		});

		it('should list spaces only with brand id from params as not logged in user', async () => {
			const queryParams: SpaceFilterRequest = { limit: 100, brandId: brandIds[Math.floor(Math.random() * itemsToGenerate)] };
			let r = getRequest({ url, entity: SpaceEntity }).query(queryParams);
			const { body } = await r;
			expect(body.data).toEqual(
				expect.not.arrayContaining([expect.not.objectContaining({ venue: expect.objectContaining({ brandId: queryParams.brandId }) })])
			);
		});

		it('should list spaces only with space type id from params as not logged in user', async () => {
			const queryParams: SpaceFilterRequest = { limit: 100, spaceTypeId: spaceTypeIds[Math.floor(Math.random() * itemsToGenerate)] };
			let r = getRequest({ url, entity: SpaceEntity }).query(queryParams);
			const { body } = await r;
			expect(body.data).toEqual(expect.not.arrayContaining([expect.not.objectContaining({ spaceTypeId: queryParams.spaceTypeId })]));
		});

		it('should list spaces only with space type id ARRAY from params as not logged in user', async () => {
			const queryParams: SpaceFilterRequest = { limit: 100, spaceTypeIds: [spaceTypeIds[Math.floor(Math.random() * itemsToGenerate)]] };
			let r = getRequest({ url, entity: SpaceEntity }).query(queryParams);
			const { body } = await r;
			expect(body.data).toEqual(expect.not.arrayContaining([expect.not.objectContaining({ spaceTypeIds: queryParams.spaceTypeIds![0] })]));
		});

		it('should list spaces only with capacity from params as not logged in user', async () => {
			const queryParams: SpaceFilterRequest = { limit: 100, capacity: Number(faker.random.numeric(1)) };
			let r = getRequest({ url, entity: SpaceEntity }).query(queryParams);
			const { body } = await r;
			expect(body.data).toEqual(expect.not.arrayContaining([expect.not.objectContaining({ capacity: queryParams.capacity })]));
		});

		it('should list spaces only with quantity from params as not logged in user', async () => {
			const queryParams: SpaceFilterRequest = { limit: 100, quantity: Number(faker.random.numeric(1)) };
			let r = getRequest({ url, entity: SpaceEntity }).query(queryParams);
			const { body } = await r;
			expect(body.data).toEqual(expect.not.arrayContaining([expect.not.objectContaining({ quantity: queryParams.quantity })]));
		});

		it('should list spaces only with status from params as not logged in user', async () => {
			const statuses = Object.values(SpaceStatus);
			const queryParams: SpaceFilterRequest = { limit: 100, status: statuses[Math.floor(Math.random() * statuses.length)] };
			let r = getRequest({ url, entity: SpaceEntity }).query(queryParams);
			const { body } = await r;
			expect(body.data).toEqual(expect.not.arrayContaining([expect.not.objectContaining({ status: queryParams.status })]));
		});

		it('should list spaces only with charge types from params as not logged in user', async () => {
			const chargeTypes = Object.values(ChargeType);
			const queryParams: SpaceFilterRequest = { limit: 100, chargeType: chargeTypes[Math.floor(Math.random() * chargeTypes.length)] };
			let r = getRequest({ url, entity: SpaceEntity }).query(queryParams);
			const { body } = await r;
			expect(body.data).toEqual(expect.not.arrayContaining([expect.not.objectContaining({ chargeType: queryParams.chargeType })]));
		});

		it('should list spaces only with charge types ARRAY from params as not logged in user', async () => {
			const chargeTypes = Object.values(ChargeType);
			const queryParams: SpaceFilterRequest = { limit: 100, chargeTypes: [chargeTypes[Math.floor(Math.random() * chargeTypes.length)]] };
			let r = getRequest({ url, entity: SpaceEntity }).query(queryParams);
			const { body } = await r;
			expect(body.data).toEqual(expect.not.arrayContaining([expect.not.objectContaining({ chargeTypes: queryParams.chargeTypes![0] })]));
		});

		afterAll(async () => {
			const spaceItems: SpaceEntity[] = await MainDataSource.getRepository(SpaceEntity).find({
				take: itemsToGenerate,
				order: {
					id: 'DESC',
				},
			});
			await MainDataSource.getRepository(SpaceEntity).delete(spaceItems.map((s) => s.id));

			const venueItems: VenueEntity[] = await MainDataSource.getRepository(VenueEntity).find({
				take: itemsToGenerate,
				order: {
					id: 'DESC',
				},
			});

			await MainDataSource.getRepository(VenueEntity).delete(venueItems.map((s) => s.id));

			const brandItems: BrandEntity[] = await MainDataSource.getRepository(BrandEntity).find({
				take: itemsToGenerate,
				order: {
					id: 'DESC',
				},
			});

			await MainDataSource.getRepository(BrandEntity).delete(brandItems.map((s) => s.id));
		});
	});
});
