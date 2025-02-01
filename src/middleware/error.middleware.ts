import { ExpressErrorMiddlewareInterface, HttpError, Middleware } from 'routing-controllers';
import { Service } from 'typedi';
import { NotFoundErrorResp } from '@utils/response/not-found.response';
import { UnauthorizedResponse } from '@utils/response/unauthorized.response';
import { EntityMetadataNotFoundError, QueryFailedError } from 'typeorm';
import { ForbiddenResponse } from '@utils/response/forbidden.response';
import { ValidationErrorResp } from '@utils/response/validation-error.response';
import { EntityNotFoundError } from 'typeorm/error/EntityNotFoundError';
import loggerHelper from '@helpers/logger.helper';

@Middleware({ type: 'after' })
@Service()
export default class CustomErrorHandler implements ExpressErrorMiddlewareInterface {
	error(error: any, request: any, res: any, next: (err: any) => any) {
		let responseObject = {
			status: 'error',
		} as any;
		// BadRequestError
		if (error.constructor.name === 'QueryFailedError') {
			responseObject.message = 'Internal server error';
			responseObject.code = 500;
			return res.status(500).json(responseObject);
		}

		if (error.constructor.name.indexOf('Stripe') !== -1) {
			responseObject.message = error.raw.message;
			responseObject.code = error.statusCode;
			return res.status(500).json(responseObject);
		}

		if (error.constructor.name === 'AuthorizationRequiredError' || error.constructor.name === 'UnauthorizedError') {
			responseObject.message = error.message.startsWith('Authorization is required for') ? 'Unauthorized' : error.message;
			responseObject.name = undefined;
			responseObject.stack = undefined;
			responseObject.code = 401;
			res.status(responseObject.code).json(responseObject);
		}

		// if its an array of ValidationError
		if (error instanceof ValidationErrorResp) {
			responseObject = { ...error, code: 422, status: 'error', httpCode: 422, name: 'ValidationErrorResp' };
			responseObject.message = "You have an error in your request's body. ";
		} else if (error.errors && error.errors.length) {
			responseObject = {
				data: error.errors || error.data,
				message: "You have an error in your request's body. ",
				code: 422,
				httpCode: 422,
				name: 'ValidationErrorResp',
				status: 'error',
			};
		} else {
			// set http status
			if (error instanceof HttpError && error.httpCode) {
				responseObject.code = error.httpCode;
			} else if (error instanceof UnauthorizedResponse || error instanceof ForbiddenResponse) {
				responseObject.code = error.code;
				responseObject.message = error.message;
			} else if (error instanceof NotFoundErrorResp || error instanceof EntityNotFoundError || error instanceof EntityMetadataNotFoundError) {
				responseObject.code = 404;
				responseObject.message = 'Not found';
			} else if (error instanceof QueryFailedError || error instanceof TypeError) {
				responseObject.code = 500;
				responseObject.message = 'Internal server error';
			} else if (error.constructor.name === 'PayloadTooLargeError') {
				responseObject.code = 500;
				responseObject.message = 'Request is too large';
			} else {
				responseObject.code = 500;
			}

			if (error instanceof Error) {
				const developmentMode: boolean = process.env.NODE_ENV !== 'production';

				// set response error fields
				if (error.name && developmentMode && error.message) {
					// show name only if in development mode and if error message exist too
					responseObject.name = error.name;
				}
				if (error.stack && developmentMode) {
					responseObject.stack = error.stack;
				}
			} else if (typeof error === 'string') {
				responseObject.message = error;
			}
		}

		loggerHelper.error(error);

		// send json only with error
		res.status(responseObject.code).json(responseObject);
	}
}
