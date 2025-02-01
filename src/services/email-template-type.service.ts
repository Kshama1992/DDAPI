import loggerHelper from '@helpers/logger.helper';
import EmailTemplateTypeEntity from '@entity/email-template-type.entity';
import BaseService from '@services/base.service';
import { ForbiddenResponse } from '@utils/response/forbidden.response';
import UserEntity from '@entity/user.entity';
import { Service } from 'typedi';
import MainDataSource from '@src/main-data-source';

/**
 * EmailTemplateTypeService
 */
@Service()
export default class EmailTemplateTypeService extends BaseService {
	constructor() {
		super();
		this.entity = EmailTemplateTypeEntity;
	}

	async single(id: number): Promise<EmailTemplateTypeEntity | undefined> {
		return MainDataSource.getRepository(EmailTemplateTypeEntity).findOneOrFail({ where: { id }, relations: ['templateVariables'] });
	}

	async list(): Promise<[EmailTemplateTypeEntity[], number]> {
		try {
			return await MainDataSource.getRepository(EmailTemplateTypeEntity)
				.createQueryBuilder('EmailTemplateType')
				.leftJoinAndSelect('EmailTemplateType.templateVariables', 'templateVariables')
				.orderBy('EmailTemplateType.name', 'ASC')
				.limit(99999)
				.getManyAndCount();
		} catch (e) {
			loggerHelper.error(e);
			throw e;
		}
	}

	async delete(id: number, requestedByUser?: UserEntity | undefined): Promise<any> {
		throw new ForbiddenResponse();
	}
}
