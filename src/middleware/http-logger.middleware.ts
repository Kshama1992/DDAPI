import { Request, Response, NextFunction } from 'express';
import clc from 'cli-color';
import dayjs from 'dayjs';
import { NODE_ENV } from '@src/config';
import loggerHelper from '@helpers/logger.helper';

const HttpLoggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
	if (NODE_ENV !== 'production') {
		let now = dayjs();
		let method = req.method;
		let status = res.statusCode;
		let statusString: string | number = status;
		if (String(status).startsWith('2')) statusString = clc.green.bold(status);
		if (String(status).startsWith('5')) statusString = clc.red.bold(status);
		if (String(status).startsWith('4')) statusString = clc.white.bold(status);

		let methodString: string = method;
		if (method === 'GET') methodString = clc.green.bold(method);
		if (method === 'POST') methodString = clc.yellow.bold(method);
		if (method === 'PUT') methodString = clc.yellow.bold(method);
		if (method === 'DELETE') methodString = clc.red.bold(method);
		let url = clc.cyan(req.url);
		let log = ` ${methodString}:${url} ${statusString}`;

		res.on('finish', () => {
			loggerHelper.log({ level: 'info', message: `${log} - response time to header: ${dayjs().diff(now, 'millisecond')} ms` });
		});
	}
	if (next) {
		next();
	}
};
export default HttpLoggerMiddleware;
