import BaseService from '@services/base.service';
import { Service } from 'typedi';
import PaymentModeEntity from '@src/entity/payment-mode.entity';

/**
 * Payment Mode Service
 */
@Service()
export default class PaymentModeService extends BaseService {
	constructor() {
		super();
		this.entity = PaymentModeEntity;
	}
}
