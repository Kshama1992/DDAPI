import { JsonController, Post, Body, BadRequestError, UnauthorizedError, Res, Req } from 'routing-controllers';
import { OpenAPI } from '@utils/openapi';
import { hash } from 'bcryptjs';
import UserEntity from '@entity/user.entity';
import UserStatus from 'dd-common-blocks/dist/type/UserStatus';
import TeamService from '@services/team.service';
import { SuccessResponse } from '@utils/response/success.response';
import loggerHelper from '@helpers/logger.helper';
import { sendUserDefinedTemplate } from '@helpers/send-mail.helper';
import { AWS_URL, DEFAULT_BRAND_NAME, DOMAIN } from '@src/config';
import AuthService from '@services/auth.service';
import { UserService } from '@src/services';
import { Inject, Service } from 'typedi';
import CreateUserDto from '@src/dto/create-user.dto';
import winstonLogger from '@src/utils/helpers/winston-logger';

@JsonController('/auth')
@Service()
export class AuthController {
	@Inject()
	authService: AuthService;
	@Inject()
	userService: UserService;

	/**
	 * Check user status and respond with 401 status or TRUE
	 * @param {UserEntity} user - User data
	 * @returns {true | undefined}
	 */
	checkUserStatus(user: UserEntity): true | undefined {
		if ([UserStatus.SUSPENDED, UserStatus.MOVEOUT, UserStatus.DELETED].includes(user.status)) {
			let statusName: string = user.status;
			if (user.status === UserStatus.MOVEOUT) statusName = 'moved out';
			if (user.status === UserStatus.SUSPENDED) statusName = 'suspended';
			if (user.status === UserStatus.DELETED) statusName = 'deleted';

			throw new UnauthorizedError(`Your account has been ${statusName}, please contact your brand admin`);
		}
		return true;
	}

	@OpenAPI({
		description: 'Log out user',
	})
	@Post('/log-out')
	async logout(@Res() response: any, @Req() request: any) {
		if(request.isFromMobApp != null && request.isFromMobApp == 'true'){
		const body ={
			fcmtoken : null
		}
		await this.userService.saveFcmToken(request.user_id, body);
	   }
		await this.authService.deleteToken(response, request);
		return new SuccessResponse({ data: {} });
	}

	@OpenAPI({
		description: 'User login with username and password',
	})
	@Post('/login')
	async loginWithUsername(
		@Body() { username, password, inviteToTeamId }: { username?: string; password?: string; inviteToTeamId?: number },
		@Res() response: any,
		@Req() request: any
	) {
		if (!(username && password)) {
			throw new BadRequestError('Please provide the correct username and password.');
		}
		const user = await this.userService.getByUsername(username);
		if (!user) {
			throw new UnauthorizedError(`Wrong username or password.`);
		}

		const passwordsMatch = await user.comparePassword!(password);

		if (!passwordsMatch) {
			throw new UnauthorizedError(`Wrong username or password.`);
		}

		const isUserStatusOk = this.checkUserStatus(user);

		if (!isUserStatusOk) {
			throw new UnauthorizedError('User status is not ok. Please contact administrator.');
		}

		if (inviteToTeamId && !user.teamMembership!.find((tm) => tm.teamId === Number(inviteToTeamId))) {
			const teamService = new TeamService();
			await teamService.addMember({ teamId: inviteToTeamId, memberId: user.id, createdById: user.id, email: user.email }, user);
		}

		const data = await this.authService.createTokens(response, request, user.id);
		return new SuccessResponse({ data });
	}

	/**
	 * Forgot password method.
	 * @returns {Promise<void>}
	 */
	@OpenAPI({
		description: 'Forgot password',
	})
	@Post('/forgot-password')
	async forgotPassword(@Body() { email }: { email?: string }) {
		if (!email) {
			throw new BadRequestError('Please provide the correct user email.');
		}

		const successMessage =
			'A reset link is sent to your mail if your mail exists in the system. If you didn’t receive the link, please check that you are entering your email address correctly and try again';

		const user = await this.userService.getByEmail(email);
		if (!user) {
			return new SuccessResponse({
				data: {},
				message: successMessage,
			});
		}

		const token = await this.authService.generateForgotPassToken(String(user.id));

		await sendUserDefinedTemplate('Reset password', {
			brandId: user.brandId,
			user: {
				firstName: user.firstname,
				lastName: user.lastname,
				username: user.username,
				fullname: `${user.firstname} ${user.lastname}`,
				email: user.email,
				photo: user.photo ? `${AWS_URL}/434x176${user.photo.url}` : `https://${DOMAIN}/images/header/default-avatar.png`,
				phone: user.phone,
			},
			emailTo: email,
			token,
			resetPasswordUrl: `https://${DOMAIN}/forgot-password-confirm/${token}`,
		});

		return new SuccessResponse({ message: successMessage, data: {} });
	}

	/**
	 * Forgot password validate token from url user got in email.
	 */
	@OpenAPI({
		description: 'Validate forgot password token',
	})
	@Post('/forgot-password-validate')
	async forgotPasswordValidate(@Body() { token }: { token?: string }) {
		if (!token) {
			throw new BadRequestError('No token provided');
		}

		await this.authService.validateResetPassToken(token);
		return new SuccessResponse({ message: 'Ok', data: {} });
	}

	/**
	 * Do reset password
	 */
	@OpenAPI({
		description: 'Confirm forgot password token',
	})
	@Post('/forgot-password-confirm')
	async forgotPasswordConfirm(@Body() { token }: { token?: string }) {
		if (!token) {
			throw new BadRequestError('No token provided');
		}
		await this.authService.resetPassword(token);
		return new SuccessResponse({ message: 'Ok', data: {} });
	}

	@OpenAPI({
		description: 'Send OTP code to phone',
	})
	@Post('/code-send')
	async sendVerifyCode(@Body() { phone }: { phone?: string }) {
		console.log("sendAuthCode api call : ", phone)
		if (typeof phone === 'undefined' || phone === '') {
			throw new BadRequestError('Not found phone');
		}
		await this.authService.sendAuthCode(phone);
		console.log("sendAuthCode api call end : ", phone)
		return new SuccessResponse({ data: `Verification code sent to ${phone}` });
	}

	@OpenAPI({
		description: 'Sign up user',
	})
	@Post('/sign-up')
	async create(@Body() data: CreateUserDto, @Res() response: any, @Req() request: any) {
		const userData = await this.userService.create(data);
		const tokenData = await this.authService.createTokens(response, request, userData.id);
		return new SuccessResponse({ data: { ...tokenData, userData } });
	}

	@OpenAPI({
		description: 'Check if user already registered by username or email',
	})
	@Post('/check-exist')
	async checkExist(@Body() data: { email?: string; username?: string }) {
		winstonLogger.info(`checkExist: ${data}`);
		const counter = await this.userService.checkExist(data);
		return new SuccessResponse({ data: { exist: !!counter } });
	}

	@OpenAPI({
		description: 'Validate user email and check if already taken',
	})
	@Post('/validate-email')
	async validateEmail(@Body() { email, userId }: { email?: string; userId: string }): Promise<SuccessResponse<{ valid: boolean }>> {
		try {
			winstonLogger.info(`validateEmail: ${email}`);
			if (!email) return new SuccessResponse<{ valid: boolean }>({ data: { valid: false } });
			const isValid = await this.userService._emailValidator(email, userId);
			winstonLogger.info(`validateEmail: ${isValid}`);
			return new SuccessResponse<{ valid: boolean }>({ data: { valid: isValid } });
		} catch (e) {
			return new SuccessResponse<{ valid: boolean }>({ data: { valid: false } });
		}
	}

	@OpenAPI({
		description: 'Validate user name and check if already taken',
	})
	@Post('/validate-username')
	async validateUsername(@Body() { username, userId }: { username?: string; userId: string }) {
		try {
			winstonLogger.info(`validateUsername: ${username}`);
			if (!username) return new SuccessResponse({ data: { valid: false } });
			const isValid = await this.userService._nameValidator(username, userId);
			winstonLogger.info(`validateUsername: ${isValid}`);
			return new SuccessResponse({ data: { valid: isValid } });
		} catch (e) {
			return new SuccessResponse({ data: { valid: false } });
		}
	}

	@OpenAPI({
		description: 'Validate user phone and check if already taken',
	})
	@Post('/validate-phone')
	async validatePhone(@Body() { phone, userId }: { phone?: string; userId: string }) {
		try {
			winstonLogger.info(`validatePhone: ${phone}`);
			if (!phone) return new SuccessResponse({ data: { valid: false } });
			const isValid = await this.userService._phoneValidator(phone, userId);
			winstonLogger.info(`validatePhone: ${isValid}`);
			return new SuccessResponse({ data: { valid: isValid } });
		} catch (e) {
			loggerHelper.error(e);
			return new SuccessResponse({ data: { valid: false } });
		}
	}

	@OpenAPI({
		description: 'Verify OTP code',
	})
	@Post('/code-verify')
	async verifyCode(@Body() { phone, code }: { phone: number; code: string }, @Res() response: any, @Req() request: any) {
		await this.authService.checkAuthCode(+phone, code);
		try {
			const user = await this.userService.getByPhone(phone);
			const isUserStatusOk = this.checkUserStatus(user);

			if (!isUserStatusOk) {
				throw new UnauthorizedError('Unhandled auth');
			}

			const data = await this.authService.createTokens(response, request, user.id);
			return new SuccessResponse({ data });
		} catch {
			return new SuccessResponse({ data: { hash: await hash(DEFAULT_BRAND_NAME, 10) } });
		}
	}

	@OpenAPI({
		description: 'Refresh token',
	})
	@Post('/refresh-token')
	async refreshToken(@Body() { refreshToken }: { refreshToken: string }, @Res() response: any, @Req() request: any) {
		return this.authService.refreshToken(request, response, refreshToken);
	}
}
