import request from 'supertest';
import { app } from '../../../jest.setup.env';

const url = '/wp';

describe(`ROUTE: ${url}`, () => {
	it('GET should return venues array', async () => {
		const { body, statusCode } = await request(app.app).get(`${url}/venue`);

		// const searchObj = {
		// 	id: expect.any(Number),
		// 	name: expect.any(String),
		// 	accessHoursFrom: expect.any(String),
		// 	accessHoursTo: expect.any(String),
		// 	description: expect.any(String),
		// 	city: expect.any(String),
		// 	state: expect.any(String),
		// 	country: expect.any(String),
		// 	address: expect.any(String),
		// 	address2: expect.any(String),
		// 	accessCustom: expect.any(Boolean),
		// 	logo: expect.objectContaining({
		// 		url: expect.any(String)
		// 	}) || null,
		// 	venueType: expect.objectContaining({
		// 		name: expect.any(String)
		// 	}),
		// 	coordinates: expect.objectContaining({
		// 		type: "Point",
		// 		coordinates: expect.any(Array)
		// 	}),
		// 	photos: expect.any(Array),
		// 	accessCustomData: expect.any(Array),
		// };

		expect(statusCode).toBe(200);
		expect(body.code).toBe(200);

		expect(body).toEqual(
			expect.objectContaining({
				data: [expect.any(Array), expect.any(Number)],
				code: 200,
				status: 'success',
			})
		);
	});

	it('GET should return spaces array', async () => {
		const { body, statusCode } = await request(app.app).get(`${url}/space`);
		expect(statusCode).toBe(200);
		expect(body.code).toBe(200);

		expect(body).toEqual(
			expect.objectContaining({
				data: [expect.any(Array), expect.any(Number)],
				code: 200,
				status: 'success',
			})
		);
	});
});
