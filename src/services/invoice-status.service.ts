import InvoiceStatusEntity from '@entity/invoice-status.entity';
import InvoiceEntity from '../entity/invoice.entity';
import BaseService from '@services/base.service';
import { ForbiddenResponse } from '@utils/response/forbidden.response';
import UserEntity from '@entity/user.entity';
import MainDataSource from '@src/main-data-source';
import { Service } from 'typedi';

/**
 * Invoice status service
 */
@Service()
export default class InvoiceStatusService extends BaseService {
	constructor() {
		super();
		this.entity = InvoiceStatusEntity;
	}

	/**
	 * Delete Invoice status if no invoices
	 * @param id
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async delete(id: number, requestedByUser?: UserEntity | undefined): Promise<InvoiceStatusEntity> {
		const invoiceRepo = MainDataSource.getRepository(InvoiceEntity);
		const item = await MainDataSource.getRepository(InvoiceStatusEntity).findOneOrFail({ where: { id: +id } });
		if (!item._canDelete!(requestedByUser)) throw new ForbiddenResponse();

		const invoicesCount = await invoiceRepo.createQueryBuilder('Invoice').andWhere('Invoice.invoiceStatusId = :id', { id }).getCount();

		if (invoicesCount > 0) {
			throw new Error("Can't delete: Active invoices!");
		}

		return MainDataSource.getRepository(InvoiceStatusEntity).remove(item);
	}
}
