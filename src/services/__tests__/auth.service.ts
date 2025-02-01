import { JsonWebTokenError } from 'jsonwebtoken';
import AuthService from '../auth.service';

jest.useFakeTimers();

const service = new AuthService();

describe('JWT tokens', () => {
	beforeEach(() => jest.useFakeTimers());

	it('should return auth token for user ID 99', async () => {
		expect(service.generateToken(99)).toEqual(
			expect.objectContaining({
				expiresIn: expect.any(Number),
				accessToken: expect.any(String),
			})
		);
	});

	it('should throw "jwt malformed" error', async () => {
		const malformedError = new JsonWebTokenError('jwt malformed');
		await expect(service.validateToken('fakeToken')).rejects.toThrowError(malformedError);
	});

	it('should validate token with user ID 99', async () => {
		const tokenObj = await service.generateToken(99);
		await expect(service.validateToken(tokenObj.accessToken)).resolves.toStrictEqual({ id: 99 });
	});
});
