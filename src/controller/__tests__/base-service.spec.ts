import request from 'supertest';
import AuthService from '@services/auth.service';
import MainDataSource from '@src/main-data-source';
import { app } from '../../../jest.setup.env';

const authService = new AuthService();

interface BaseTestIntProps {
	url: string; //
	// app: App; //
	entity: any; //
	asAdmin?: boolean; // brand admin
	asMember?: boolean; // brand member
	asSuperAdmin?: boolean; // super admin
	requestUserId?: number;
}

interface TestIntSingleMethodProps extends BaseTestIntProps {
	id: number;
}

interface TestSingleMethodProps extends BaseTestIntProps {
	id?: number;
}

interface TestIntDeleteMethodProps extends BaseTestIntProps {
	id?: number;
}

interface TestIntUpdateMethodProps extends BaseTestIntProps {
	id?: number;
	updateObj: any;
}

interface TestInt404MethodProps extends BaseTestIntProps {
	id?: number;
	method?: 'get' | 'put' | 'post' | 'delete';
	obj?: any;
}

interface TestInt401MethodProps extends BaseTestIntProps {
	id?: number;
	method?: 'get' | 'put' | 'post' | 'delete';
	obj?: any;
}

interface TestInt403MethodProps extends BaseTestIntProps {
	id?: number;
	method?: 'get' | 'put' | 'post' | 'delete';
	obj?: any;
	errorMessage?: string;
}

interface TestInt422MethodProps extends BaseTestIntProps {
	id?: number;
	method?: 'get' | 'put' | 'post' | 'delete';
	obj: any;
	expectedErrors: any[];
}

interface GetRequestProps extends BaseTestIntProps {
	id?: number;
	method?: 'get' | 'put' | 'post' | 'delete';
	obj?: any;
	requestUserId?: number;
}

interface TestIntCreateMethod extends BaseTestIntProps {
	createObj: any;
}

interface TestIntListMethod extends BaseTestIntProps {
	filter?: any;
}

const getRequest = (props: GetRequestProps) => {
	const { url, method, id, asSuperAdmin, asAdmin, asMember, requestUserId } = props;
	const requestUrl = `${url}${id ? `/${id}` : ''}`;
	let r = request(app.app).get(requestUrl);
	if (method === 'delete') r = request(app.app).delete(requestUrl);
	if (method === 'post') r = request(app.app).post(requestUrl);
	if (method === 'put') r = request(app.app).put(requestUrl);

	if (asAdmin || asMember || asSuperAdmin) {
		let userId = 2;
		if (asAdmin) userId = 1;
		if (asSuperAdmin) userId = 3;

		if (requestUserId) userId = requestUserId;

		const { accessToken } = authService.generateToken(userId);
		r = r.set('auth', accessToken);
	}
	return r;
};

export async function TestIntSingleMethod(props: TestIntSingleMethodProps): Promise<void> {
	const { body, statusCode } = await getRequest(props);
	expect(statusCode).toBe(200);
	expect(body.code).toBe(200);

	const resultAsEntity = MainDataSource.getRepository(props.entity).create(body.data);

	expect(body).toEqual(
		expect.objectContaining({
			data: expect.objectContaining(resultAsEntity),
			code: 200,
			status: 'success',
		})
	);
}

export async function TestSingleMethod(props: TestSingleMethodProps): Promise<void> {
	const { body, statusCode } = await getRequest({ ...props, method: 'get' });
	expect(statusCode).toBe(200);
	expect(body.code).toBe(200);

	const getResultAsEntity = MainDataSource.getRepository(props.entity).create(body.data);

	expect(body).toEqual(
		expect.objectContaining({
			data: expect.objectContaining(getResultAsEntity),
			code: 200,
			status: 'success',
		})
	);
}

export async function TestIntDeleteMethod(props: TestIntDeleteMethodProps): Promise<void> {
	const { body, statusCode } = await getRequest({ ...props, method: 'delete' });

	expect(statusCode).toBe(200);
	expect(body.code).toBe(200);

	const resultAsEntity = MainDataSource.getRepository(props.entity).create(body.data);

	expect(body).toEqual(
		expect.objectContaining({
			data: expect.objectContaining(resultAsEntity),
			code: 200,
			status: 'success',
		})
	);
}

export async function TestIntUpdateMethod(props: TestIntUpdateMethodProps): Promise<void> {
	const { body, statusCode } = await getRequest({ ...props, method: 'put' }).send(props.updateObj);
	const resultAsEntity = MainDataSource.getRepository(props.entity).create(body.data);

	expect(statusCode).toBe(200);
	expect(body.code).toBe(200);
	expect(body).toEqual(
		expect.objectContaining({
			data: expect.objectContaining(resultAsEntity),
			code: 200,
			status: 'success',
		})
	);
}

export async function TestIntUpdate404Method(props: TestInt404MethodProps): Promise<void> {
	let body, statusCode;
	if (props.obj) {
		const res = await getRequest(props).send(props.obj);
		body = res.body;
		statusCode = res.statusCode;
	} else {
		const res = await getRequest(props);
		body = res.body;
		statusCode = res.statusCode;
	}
	expect(statusCode).toBe(404);
	expect(body.code).toBe(404);
	expect(body).toEqual(
		expect.objectContaining({
			code: 404,
			status: 'error',
			message: 'Not found',
		})
	);
}

export async function TestInt401Method(props: TestInt401MethodProps): Promise<void> {
	const { body, statusCode } = await getRequest(props).send(props.obj);
	expect(statusCode).toBe(401);
	expect(body.code).toBe(401);
	expect(body).toEqual(
		expect.objectContaining({
			code: 401,
			status: 'error',
			message: 'Unauthorized',
		})
	);
}

export async function TestInt403Method(props: TestInt403MethodProps): Promise<void> {
	const { body, statusCode } = await getRequest(props).send(props.obj);
	expect(statusCode).toBe(403);
	expect(body.code).toBe(403);
	expect(body).toEqual(
		expect.objectContaining({
			code: 403,
			status: 'error',
			message: props.errorMessage || 'Insufficient permissions',
		})
	);
}

export async function TestInt422Method(props: TestInt422MethodProps): Promise<void> {
	const { body, statusCode } = await getRequest(props).send(props.obj);
	expect(statusCode).toBe(422);
	expect(body.code).toBe(422);
	expect(body).toEqual(
		expect.objectContaining({
			code: 422,
			httpCode: 422,
			name: 'ValidationErrorResp',
			status: 'error',
			message: "You have an error in your request's body. ",
			data: expect.arrayContaining([
				expect.objectContaining({
					children: expect.any(Array),
					constraints: expect.any(Object),
					...props.expectedErrors[0],
				}),
			]),
		})
	);
	expect(body.data).toBeDefined();
}

export async function TestIntCreateMethod<T>(props: TestIntCreateMethod): Promise<T> {
	const { body, statusCode } = await getRequest({ ...props, method: 'post' }).send(props.createObj);

	const resultAsEntity = MainDataSource.getRepository(props.entity).create(body.data);

	expect(statusCode).toBe(200);
	expect(body.code).toBe(200);
	expect(body).toEqual(
		expect.objectContaining({
			data: expect.objectContaining(resultAsEntity),
			code: 200,
			status: 'success',
		})
	);
	return body.data;
}

export async function TestIntListMethod<T>(props: TestIntListMethod): Promise<void> {
	let r = getRequest(props).query(props.filter);

	const { body, statusCode } = await r;

	const resultAsEntity = MainDataSource.getRepository(props.entity).create(body.data[0]);

	expect(statusCode).toBe(200);
	expect(body.code).toBe(200);
	expect(body).toEqual(
		expect.objectContaining({
			code: 200,
			status: 'success',
			data: expect.arrayContaining([expect.objectContaining(resultAsEntity)]),
			total: expect.any(Number),
		})
	);
}

//
// export function doBaseTests({entity}) {
//
// }

export { getRequest };
