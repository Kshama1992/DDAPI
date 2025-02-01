import { promises as fs } from 'fs';
import path from 'path';
import zlib from 'zlib';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { ForbiddenResponse } from '@utils/response/forbidden.response';
import { LOG_DATE_FORMAT, LOG_PATH } from '@src/config';
import loggerHelper from '@helpers/logger.helper';
import { Service } from 'typedi';
import BaseListFilterInterface from 'dd-common-blocks/dist/interface/filter/base-list-filter.interface';
import EmailLogEntity, { EmailLogStatus } from '@entity/email-log.entity';
import MainDataSource from '@src/main-data-source';

dayjs.extend(relativeTime);

interface EmailLogQuery extends BaseListFilterInterface {
	status?: EmailLogStatus;
	brandId?: number;
	templateId?: number;
	from?: string;
	to?: string;
}

/**
 * Handle all actions with logs.
 * @module LogService
 * @category Services
 */
@Service()
export default class LogService {
	create() {
		throw new ForbiddenResponse();
	}
	update() {
		throw new ForbiddenResponse();
	}

	async list() {
		async function getAllLogFiles() {
			const files: string[] = [];
			for await (const file of getFiles()) {
				files.push(file.path);
			}
			return files;
		}

		// @ts-ignore
		async function* getFiles(pathI = `${path.resolve(LOG_PATH)}/`) {
			const entries = await fs.readdir(pathI, { withFileTypes: true });

			for (let file of entries) {
				if (file.isDirectory()) {
					yield* getFiles(`${pathI}${file.name}/`);
				} else {
					yield { ...file, path: pathI + file.name };
				}
			}
		}

		const files = await getAllLogFiles();

		const filtered = files
			.filter((e) => {
				const name = path.basename(e);
				return !name.startsWith('.');
			})
			.map((e) => {
				const name = path.basename(e);
				// refactor this later.....
				const datePattern = /[-]{0,4}[\d]*[-]{0,2}[\d]*[-]{0,2}[\d]*[-]{0,2}[\d]+/g;
				const dates = e.match(datePattern);
				const date = dates?.length ? dates[0].substring(1) : '';

				return {
					name,
					type: path.basename(path.dirname(e)),
					dateString: dayjs(date, LOG_DATE_FORMAT).fromNow(),
					date: date.slice(0, -3),
					time: `${date.substring(date.length - 2)}:00`,
				};
			})
			.sort((a, b) => (dayjs(a.date).isAfter(b.date) ? -1 : 1));

		return [filtered, filtered.length];
	}

	async single(type: string, filename: string) {
		try {
			let data: string;
			if (filename.substring(filename.length - 2) === 'gz') {
				const buffer = await fs.readFile(path.resolve(LOG_PATH, type, filename));
				const temp = await zlib.unzipSync(buffer, { finishFlush: zlib.constants.Z_SYNC_FLUSH });
				data = temp.toString();
			} else {
				data = await fs.readFile(path.resolve(LOG_PATH, type, filename), 'utf8');
			}
			const formattedData = data.replace(/\"}/g, '"},').slice(0, -2);

			return JSON.parse(`[${formattedData}]`);
		} catch (e) {
			loggerHelper.error(e);
			return [];
		}
	}

	async listEmailLogs(params: EmailLogQuery) {
		const { brandId, templateId, from, to, status, limit = 10, offset = 0 } = params;
		return MainDataSource.getRepository(EmailLogEntity)
			.createQueryBuilder('e')
			.queryAndWhere('e.brandId=:brandId', { brandId })
			.queryAndWhere('e.status=:status', { status })
			.queryAndWhere('e.templateId=:templateId', { templateId })
			.queryAndWhere('LOWER(e.from) LIKE LOWER(:from)', { from: from ? `%${from}%` : undefined })
			.queryAndWhere('LOWER(e.to) LIKE LOWER(:to)', { to: from ? `%${to}%` : undefined })
			.leftJoinAndSelect('e.brand', 'brand')
			.leftJoinAndSelect('e.template', 'template')
			.take(limit)
			.skip(offset)
			.orderBy('e.createdAt', 'DESC')
			.getManyAndCount();
	}

	async getSingleEmailLog(id: number) {
		return MainDataSource.getRepository(EmailLogEntity).findOneOrFail({ where: { id }, relations: ['template', 'brand'] });
	}
	delete() {}
	deleteSingleRecord() {}
}
