import EmailVariableEntity from '@entity/email-variable.entity';
import BaseService from '@services/base.service';
import { Service } from 'typedi';

@Service()
export default class EmailVariablesService extends BaseService {
	constructor() {
		super();
		this.entity = EmailVariableEntity;
	}
}
