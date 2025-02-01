import InvoiceEntity from '../entity/invoice.entity';
import BaseService from '@services/base.service';
import { ForbiddenResponse } from '@utils/response/forbidden.response';
import UserEntity from '@entity/user.entity';
import MainDataSource from '@src/main-data-source';
import { Service } from 'typedi';
import SecurityDepositStatusEntity from '@src/entity/securityDeposit-status.entity';

/**
 * Invoice status service
 */
@Service()
export default class SecurityDepositStatusService extends BaseService {
	constructor() {
		super();
		this.entity = SecurityDepositStatusEntity;
	}

	/**
	 * Delete Invoice status if no invoices
	 * @param id
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async delete(id: number, requestedByUser?: UserEntity | undefined): Promise<SecurityDepositStatusEntity> {
		const securityDepositRepo = MainDataSource.getRepository(InvoiceEntity);
		const item = await MainDataSource.getRepository(SecurityDepositStatusEntity).findOneOrFail({ where: { id: +id } });
		if (!item._canDelete!(requestedByUser)) throw new ForbiddenResponse();

		const invoicesCount = await securityDepositRepo.createQueryBuilder('Invoice').andWhere('Invoice.securityDepsoitStatusId = :id', { id }).getCount();

		if (invoicesCount > 0) {
			throw new Error("Can't delete: Active invoices!");
		}

		return MainDataSource.getRepository(SecurityDepositStatusEntity).remove(item);
	}
}
