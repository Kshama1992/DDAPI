import { JsonController } from 'routing-controllers';
import AbstractControllerTemplate from '@utils/abstract.controller.template';
import { Inject, Service } from 'typedi';
import PaymentModeService from '@src/services/payment-mode.service';

@Service()
@JsonController('/payment-mode/')
export class PaymentModeController extends AbstractControllerTemplate {
	@Inject()
	service: PaymentModeService;
}
