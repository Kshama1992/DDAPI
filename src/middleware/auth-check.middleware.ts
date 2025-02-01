import { Action } from 'routing-controllers';
import AuthService from '@services/auth.service';
import MainDataSource from '@src/main-data-source';
import UserEntity from '@entity/user.entity';
import { TOKEN_COOKIE_NAME } from '@src/config';
import { getCognitoVerifiers } from '@src/utils/helpers/cognitoUtils';
import winstonLogger from '@src/utils/helpers/winston-logger';

export default async function AuthCheckMiddleware(action: Action, roles: string[]) {

	let token: string;

	if (action.request.headers['authorization']) {

		token = action.request.headers['authorization'];
		winstonLogger.info(`auth check middleware*******token: ${JSON.stringify(token)}`);

		const { adminVerifier, userVerifier } = await getCognitoVerifiers();

		try {
			let payload;
			try {
				payload = await adminVerifier.verify(token);
				winstonLogger.info('auth check middleware*******Admin pool verification successful');
			} catch (adminError) {
				winstonLogger.error(`auth check middleware*******Admin pool verification failed, trying user pool. Error is ${JSON.stringify(adminError)}`);
				payload = await userVerifier.verify(token);
				winstonLogger.info('auth check middleware*******User pool verification successful');
			}
			
			winstonLogger.info(`auth check middleware************payload: ${JSON.stringify(payload)}`);
			const user = await MainDataSource
				.getRepository(UserEntity)
				.findOneOrFail({
					where: { email: payload.email!.toString() },
					relations: { role: true },
				});
				winstonLogger.info(`auth check middleware************user: ${JSON.stringify(user)}`);
			if (user) {
				return true;
			}
		} catch (error) {
			winstonLogger.error(`auth check middleware*******Verification failed for both pools ${JSON.stringify(error)}`);
		}
	}
	const cookieToken = action.request.signedCookies[TOKEN_COOKIE_NAME];
	token = cookieToken || action.request.headers['auth'];
	console.log('*******old_token', token);
	const authService = new AuthService();
	if (typeof token === 'undefined' || token === '' || token === 'null') {
		return false;
	}

	try {
		const jwtPayload = await authService.validateToken(token);
		const user = await MainDataSource.getRepository(UserEntity).findOneOrFail({
			where: { id: jwtPayload.id },
			relations: { role: true },
		});
		console.log('**********old_user', user);
		return !!user;
	} catch {
		return false;
	}
}
