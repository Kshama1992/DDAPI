import { Action } from 'routing-controllers';
import AuthService from '@services/auth.service';
import MainDataSource from '@src/main-data-source';
import UserEntity from '@entity/user.entity';
import { TOKEN_COOKIE_NAME } from '@src/config';
import winstonLogger from '@src/utils/helpers/winston-logger';
import { getCognitoVerifiers } from '@src/utils/helpers/cognitoUtils';

export default async function CurrentUserMiddleware(action: Action) {
	let auth_token: string;

	if (isV2ApiPath(action)) {

		winstonLogger.info('current user middleware*******V2 API Path');
		if (action.request.headers['x-api-key']) {
			auth_token = action.request.headers['auth'];
		} else {
			auth_token = action.request.headers['authorization'];
		}
		winstonLogger.info(`current user middleware*******token : ${JSON.stringify(auth_token)}`);

		const { adminVerifier, userVerifier } = await getCognitoVerifiers();

		try {
			let payload;
			try {
				payload = await adminVerifier.verify(auth_token);
				winstonLogger.info('current user middleware**********Admin pool verification successful');
			} catch (adminError) {
				winstonLogger.info('Admin pool verification failed, trying user pool');
				payload = await userVerifier.verify(auth_token);
				winstonLogger.info('current user middleware**********User pool verification successful');
			}
			winstonLogger.info(`current user middleware************payload : ${JSON.stringify(payload)}`);
			return await MainDataSource.getRepository(UserEntity).findOne({ where: { email: payload.email?.toString() }, relations: { role: true } });
		} catch (e) {
			winstonLogger.error(`current user middleware*********Error in verifying token: ${JSON.stringify(e)}`);
			return undefined;
		}
	}

	const cookieToken = action.request.signedCookies[TOKEN_COOKIE_NAME];
	const token = cookieToken || action.request.headers['auth'];
	const authService = new AuthService();

	if (!token) return undefined;

	try {
		const jwtPayload = await authService.validateToken(token);
		return await MainDataSource.getRepository(UserEntity).findOne({ where: { id: jwtPayload.id }, relations: { role: true } });
	} catch (e) {
		return undefined;
	}
}

function isV2ApiPath(action: Action): boolean {
	return action.request.headers['authorization'] || action.request.headers['x-api-key'];
}

