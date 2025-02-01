import PackageShowEntity from '@entity/package-show.entity';
import BaseService from '@services/base.service';
import { Service } from 'typedi';

/**
 * Package show service
 */
@Service()
export default class PackageShowService extends BaseService {
	constructor() {
		super();
		this.entity = PackageShowEntity;
	}
}
