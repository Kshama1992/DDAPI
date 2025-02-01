import { MoreThan } from 'typeorm';
import { Response, Request } from 'express';
import getRandomInt from '@helpers/get-random-int.helper';
import { developerPhoneNumbers, sendSMS } from '@helpers/twilio';
import PhoneAuthEntity from '@entity/phone-auth.entity';
import dayjs from 'dayjs';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import * as path from 'path';
import loggerHelper from '@helpers/logger.helper';
import {
	AWS_URL,
	DOMAIN,
	NODE_ENV,
	TOKEN_EXPIRES_IN,
	REFRESH_TOKEN_EXPIRES_IN,
	PRIVATE_KEY_PASSPHRASE,
	REFRESH_TOKEN_PASSPHRASE,
	REFRESH_TOKEN_COOKIE_NAME,
	TOKEN_COOKIE_NAME,
	COOKIE_DOMAIN
} from '@src/config';
import UserResetPassEntity from '@entity/user-reset-pass.entity';
import UserEntity from '@entity/user.entity';
import getRandomTextHelper from '@helpers/get-random-text.helper';
import { sendUserDefinedTemplate } from '@helpers/send-mail.helper';
import { SignOptions, VerifyOptions } from 'jsonwebtoken';
import MainDataSource from '@src/main-data-source';
import { Service } from 'typedi';
import TokenEntity from '@entity/token.entity';
import { SuccessResponse } from '@utils/response/success.response';
import { UnauthorizedError } from 'routing-controllers';
import Socket from '@src/socket';
import SocketEventsType from 'dd-common-blocks/dist/type/SocketEventsType';

/**
 * To generate tokens we use generated 512 bits key.
 * @type {string}
 */
const privateKEY = fs.readFileSync(path.resolve('./keys', 'private.pem'), 'utf8'); // to sign JWT
const publicKEY = fs.readFileSync(path.resolve('./keys', 'public.pem'), 'utf8'); // to verify JWT

const refreshPrivateKEY = fs.readFileSync(path.resolve('./keys', 'private-refresh.pem'), 'utf8'); // to sign JWT
const refreshPublicKEY = fs.readFileSync(path.resolve('./keys', 'public-refresh.pem'), 'utf8'); // to verify JWT

const testPass = '4UzSrvbHu89fkAQz';
/**
 * Handle all actions with authentication.
 * @module Authentication service
 * @category Services
 */
@Service()
export default class AuthService {
	baseCookieOpts = {
		path: '/',
		secure: true,
		domain: DOMAIN.includes('localhost') ? '' : COOKIE_DOMAIN
	};

	saveHttpOnlyCookie(key: string, value: string, response: Response) {
		response.cookie(key, value, {
			httpOnly: true,
			sameSite: 'strict',
			expires: dayjs().add(REFRESH_TOKEN_EXPIRES_IN, 's').toDate(),
			signed: true,
			...this.baseCookieOpts,
		});
	}
	saveAccessTokenCookie(response: Response, accessToken: string) {
		this.saveHttpOnlyCookie(TOKEN_COOKIE_NAME, accessToken, response);
	}

	saveRefreshTokenCookie(response: Response, refreshToken: string) {
		this.saveHttpOnlyCookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, response);
	}

	saveUserDataCookie(response: Response, userId: number) {
		response.cookie('u', JSON.stringify({ id: userId }), {
			expires: dayjs().add(REFRESH_TOKEN_EXPIRES_IN, 's').toDate(),
			sameSite: 'strict',
			...this.baseCookieOpts,
			secure: true,
		});
	}

	deleteCookie(response: Response, valueName: string) {
		response.cookie(valueName, '', {
			httpOnly: true,
			signed: true,
			sameSite: 'strict',
			expires: new Date(),
			...this.baseCookieOpts,
		});
	}
	/**
	 * Generate authentication token for user.
	 * @param {number} userId
	 * @returns {{accessToken: string, expiresIn: number}}
	 */
	generateToken(userId: number): { accessToken: string; expiresIn: number; refreshToken: string } {
		try {
			const signKey = NODE_ENV === 'test' ? testPass : { key: privateKEY, passphrase: String(PRIVATE_KEY_PASSPHRASE) };
			const refreshKey = NODE_ENV === 'test' ? testPass : { key: refreshPrivateKEY, passphrase: String(REFRESH_TOKEN_PASSPHRASE) };
			const opts: SignOptions = { expiresIn: TOKEN_EXPIRES_IN };
			const refreshOpts: SignOptions = { expiresIn: REFRESH_TOKEN_EXPIRES_IN };

			if (NODE_ENV !== 'test') {
				opts.algorithm = 'RS256';
				refreshOpts.algorithm = 'RS256';
			}

			const accessToken = jwt.sign(
				{
					id: userId,
				},
				signKey,
				opts
			);

			const refreshToken = jwt.sign(
				{
					id: userId,
				},
				refreshKey,
				refreshOpts
			);

			return {
				refreshToken,
				accessToken,
				expiresIn: TOKEN_EXPIRES_IN,
			};
		} catch (e) {
			loggerHelper.error(e);
			throw e;
		}
	}

	/**
	 * Validate refresh token
	 * @param {string} token
	 * @returns {Promise<{id: number}>}
	 */
	async validateRefreshToken(token: string): Promise<{ id: number }> {
		try {
			const opts: VerifyOptions = {};
			if (NODE_ENV !== 'test') opts.algorithms = ['RS256'];
			const decoded = jwt.verify(token, NODE_ENV === 'test' ? testPass : refreshPublicKEY, opts) as {
				id: number;
				iat: number;
				exp: number;
			};
			return typeof decoded === 'string' ? { id: 0 } : { id: decoded.id };
		} catch (err) {
			// console.error(err);
			loggerHelper.error(err);
			throw err;
		}
	}

	/**
	 * Validate token
	 * @param {string} token
	 * @returns {Promise<{id: number}>}
	 */
	async validateToken(token: string): Promise<{ id: number }> {
		try {
			const opts: VerifyOptions = {};
			if (NODE_ENV !== 'test') opts.algorithms = ['RS256'];
			const decoded = jwt.verify(token, NODE_ENV === 'test' ? testPass : publicKEY, opts) as {
				id: number;
				iat: number;
				exp: number;
			};
			return typeof decoded === 'string' ? { id: 0 } : { id: decoded.id };
		} catch (err) {
			// console.error(err);
			loggerHelper.error(err);
			throw err;
		}
	}

	/**
	 * Check phone verification code previously sent to user phone and if code exist in db marks it as verified.
	 * @param {number} phone
	 * @param {string} code
	 * @returns {Promise<PhoneAuthEntity | Error>}
	 */
	async checkAuthCode(phone: number, code: string): Promise<PhoneAuthEntity | Error> {
		try {
			const phoneAuth = await MainDataSource.getRepository(PhoneAuthEntity).findOneOrFail({
				where: { phone: +phone, code, verified: false, createdAt: MoreThan(dayjs().subtract(1, 'hour').toDate()) },
			});

			if (dayjs().diff(dayjs(phoneAuth.createdAt), 'hour') > 1) {
				await MainDataSource.getRepository(PhoneAuthEntity).remove(phoneAuth);
				throw new UnauthorizedError('Verification code expired');
			}

			phoneAuth.verified = true;
			phoneAuth.verifiedAt = new Date();
			await MainDataSource.getRepository(PhoneAuthEntity).save(phoneAuth);
			return phoneAuth;
		} catch (e) {
			throw new UnauthorizedError('Wrong code or already used!');
		}
	}

	/**
	 * Generates user reset password record in DB with unique token record.
	 * @param {string} userId
	 * @returns {Promise<string>} Returns token string
	 */
	async generateForgotPassToken(userId: string): Promise<string> {
		const expiresIn = TOKEN_EXPIRES_IN;
		const token = await this.generateToken(Number(userId));
		const now = new Date();
		now.setSeconds(now.getSeconds() + expiresIn);
		const entry = await MainDataSource.getRepository(UserResetPassEntity).create({
			expiresAt: now,
			userId: Number(userId),
			token: token.accessToken,
		});
		await MainDataSource.getRepository(UserResetPassEntity).save(entry);

		return token.accessToken;
	}

	/**
	 * Generates user reset password record in DB with unique token record.
	 * @param {string} token
	 * @returns {Promise<true | Error>}
	 */
	async validateResetPassToken(token: string): Promise<true | Error> {
		const existToken = await MainDataSource.getRepository(UserResetPassEntity).findOneOrFail({ where: { token } });
		const isExpired = dayjs(existToken.expiresAt).isBefore(dayjs());
		if (isExpired) throw new Error('Token expired');
		await this.clearTokensByUserId(existToken.userId);
		return true;
	}

	/**
	 * Generates new password for user
	 * @param {string} token
	 * @returns {Promise<true | Error>}
	 */
	async resetPassword(token: string): Promise<true | Error> {
		const userRepo = MainDataSource.getRepository(UserEntity);
		const existToken = await MainDataSource.getRepository(UserResetPassEntity).findOneOrFail({ where: { token } });
		const user = await userRepo.findOneOrFail({ where: { id: existToken.userId }, relations: { photo: true } });

		const tokenRepo = MainDataSource.getRepository(TokenEntity);
		const userTokens = await tokenRepo.find({ where: { userId: existToken.userId } });
		await tokenRepo.remove(userTokens);

		const passwordString = getRandomTextHelper(25);
		user.password = passwordString;
		await userRepo.save(user);

		Socket.connection().sendEventToUser(String(existToken.userId), SocketEventsType.PASSWORD_CHANGED, {
			message: 'Password changed.',
		});

		await sendUserDefinedTemplate('New password', {
			brandId: user.brandId,
			user: {
				firstName: user.firstname,
				lastName: user.lastname,
				username: user.username,
				password: passwordString,
				fullname: `${user.firstname} ${user.lastname}`,
				email: user.email,
				photo: user.photo ? `${AWS_URL}/434x176${user.photo.url}` : `https://${DOMAIN}/images/header/default-avatar.png`,
				phone: user.phone,
			},
			emailTo: user.email,
		});

		return true;
	}

	/**
	 * Send verification code to user phone and creates db record.
	 * @param {string} phone
	 * @returns {Promise<PhoneAuthEntity>}
	 */
	async sendAuthCode(phone: string): Promise<PhoneAuthEntity> {
		try {
			console.log("sendAuthCode phone: ", phone)
			const code: string = developerPhoneNumbers.indexOf(String(phone)) > -1 ? '00000' : String(getRandomInt(10000, 99999));
 			console.log("sendAuthCode code: ", code)
			const authData: Partial<PhoneAuthEntity> = {
				phone: Number(phone),
				code,
				verified: false,
			};
			console.log("sendAuthCode authData: ", authData)

			const phoneAuth: PhoneAuthEntity = await MainDataSource.getRepository(PhoneAuthEntity).create(authData);
			console.log("sendAuthCode phoneAuth: ", phoneAuth)

			const res = await MainDataSource.getRepository(PhoneAuthEntity).save(phoneAuth);

			if (code === '00000') {
				return res;
			}

			const data = await sendSMS({ to: String(phone), body: `DropDesk ${code} is your verification code.` });
			console.log("sendAuthCode response: ", data)
			return res;
		} catch (e) {
			loggerHelper.error(e);
			console.log("sendAuthCode error: ", e)
			throw new Error("SMS wasn't sent!");
		}
	}

	async createTokens(response: Response, request: Request, userId: number) {
		const data = this.generateToken(userId);

		const {
			// @ts-ignore
			fingerprint: { hash, components },
		} = request;

		const tokenRepo = MainDataSource.getRepository(TokenEntity);

		const exist = await tokenRepo.findOne({ where: { hash } });

		if (exist) await tokenRepo.remove(exist);

		await tokenRepo.save({
			token: data.accessToken,
			refreshToken: data.refreshToken,
			userId,
			hash,
			deviceData: components,
		});

		this.saveAccessTokenCookie(response, data.accessToken);
		this.saveRefreshTokenCookie(response, data.refreshToken);
		this.saveUserDataCookie(response, userId);

		return data;
	}

	async refreshToken(request: Request, response: Response, refreshToken?: string) {
		const refToken = refreshToken || request.signedCookies[REFRESH_TOKEN_COOKIE_NAME];

		const {
			// @ts-ignore
			fingerprint: { hash, components },
		} = request;

		const tokenRepo = MainDataSource.getRepository(TokenEntity);

		const exist = await tokenRepo.findOneOrFail({ where: { refreshToken: refToken, hash } });

		try {
			const { id } = await this.validateRefreshToken(refToken);

			const { accessToken } = this.generateToken(id);

			this.saveAccessTokenCookie(response, accessToken);

			exist.token = accessToken;

			await tokenRepo.save(exist);
			return new SuccessResponse({ data: { accessToken } });
		} catch {
			await tokenRepo.remove(exist);
			throw new UnauthorizedError('Wrong token');
		}
	}

	async clearTokensByUserId(userId: number) {
		const tokenRepo = MainDataSource.getRepository(TokenEntity);
		try {
			const exist = await tokenRepo.find({ where: { userId } });
			await tokenRepo.remove(exist);
		} catch {
			loggerHelper.error('wrong user to delete token -', userId);
		}
	}

	async deleteToken(response: Response, request: Request) {
		const token = request.signedCookies[REFRESH_TOKEN_COOKIE_NAME];
		if (!token) return;
		this.deleteCookie(response, REFRESH_TOKEN_COOKIE_NAME);
		this.deleteCookie(response, TOKEN_COOKIE_NAME);
		this.deleteCookie(response, 'u');
		const tokenRepo = MainDataSource.getRepository(TokenEntity);
		try {
			const exist = await tokenRepo.findOneOrFail({ where: { token } });
			await tokenRepo.remove(exist);
		} catch {
			loggerHelper.error('wrong token -', token);
		}
	}
}
