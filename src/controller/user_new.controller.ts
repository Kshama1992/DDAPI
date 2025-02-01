import { JsonController, Get, QueryParams, Authorized, CurrentUser, Res, Post, Body } from 'routing-controllers';
import { Service } from 'typedi';
import  UserService from '@src/services/user.service';
import { SuccessResponse } from '@src/utils/response/success.response';
import type UserEntity from '@src/entity/user.entity';
import AuthService  from '@src/services/auth.service';
import { NotFoundErrorResp } from '@src/utils/response/not-found.response';
import { ErrorResponse } from '@src/utils/response/error.response';
import winstonLogger from '@src/utils/helpers/winston-logger';

@JsonController('/v2/user')
@Service()
export class UserNewController {

	userService = new UserService();
    authService = new AuthService();

    @Authorized()
	@Get('/find')
    async findUserByEmail(@QueryParams() params: any, 
        @CurrentUser() currentUser: UserEntity, 
        @Res() response: any) {
    	
		const { email } = params;
        if (!email) {
            return 'Email parameter is required';
        }

        const user = await this.userService.getByEmail(email);
        if (!user) {
            throw new NotFoundErrorResp({ message: 'User not found' });
        }
        const userWithMembershipDetails = await this.userService.single(user.id, currentUser);
		console.log('***********user', userWithMembershipDetails);
        this.authService.saveUserDataCookie(response, userWithMembershipDetails.id);

		return new SuccessResponse({ data: userWithMembershipDetails});		
    }

    @Get('/find-email')
    async findUserByEmailOpen(@QueryParams() params: any, 
        @Res() response: any) {
    	
		const { email } = params;
        if (!email) {
            return 'Email parameter is required';
        }

        const user = await this.userService.getByEmail(email);
        if (!user) {
            throw new NotFoundErrorResp({ message: 'User not found' });
        }
		console.log('***********user', user);
		return new SuccessResponse({ data: user.id});		
    }

    @Get('/sync-password-entry')
    async getPasswordEntry(@QueryParams() params: any, @Res() response: any) {

        const { email } = params;
        if (!email) {
            return new ErrorResponse({ message: 'Email is required' });
        }
        try {
            winstonLogger.info(`Getting Syncing password for email: ${email}`);
            const password = await this.userService.getPasswordEntry(email);
            return new SuccessResponse({ data: password });
        } catch (error) {
            winstonLogger.error(`Error getting Syncing password for email: ${email}`);
            throw new ErrorResponse({ message: 'Error getting Syncing password entry for the email' });
        }
    }

    @Post('/sync-password-entry')
    async putPasswordEntry(@Body() body: { email:string,password: string },@Res() response: any) {
        winstonLogger.info(`Adding Syncing password for email: ${body.email}`);
        const { email, password } = body;
        if (!email || !password) {
            return new ErrorResponse({ message: 'Email and password are required' });
        }
        try {
            winstonLogger.info(`Adding Syncing password for email: ${email}`);
            const result = await this.userService.putPasswordEntry(email, password);
            return new SuccessResponse({ data: result }); 
        } catch (error) {
            winstonLogger.error(`Error adding Syncing password for email: ${email}`);
            throw new ErrorResponse({ message: 'Error adding Syncing password entry for the email' });
        }
    }
}

