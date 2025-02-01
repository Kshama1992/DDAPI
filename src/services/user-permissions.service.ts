import UserPermissionEntity from '@entity/user-permission.entity';
import UserPermissionsFilter from 'dd-common-blocks/dist/interface/filter/user-permissions-filter.interface';
import BaseService from '@services/base.service';
import { Service } from 'typedi';
import MainDataSource from '@src/main-data-source';

/**
 * Permissions service
 */
@Service()
export default class UserPermissionsService extends BaseService {
	constructor() {
		super();
		this.entity = UserPermissionEntity;
	}

	/**
	 * Get Permissions list with filter
	 * @param params
	 */
	async list(params: UserPermissionsFilter): Promise<[UserPermissionEntity[], number]> {
		const { accessLevel, limit = 10, offset = 0, searchString } = params;

		const query = MainDataSource.getRepository(UserPermissionEntity)
			.createQueryBuilder('Permission')
			.where(searchString ? `LOWER(Permission.name) LIKE LOWER(:searchString)` : '1=1', { searchString: `%${searchString}%` })
			.andWhere(accessLevel ? `Permission.accessLevel = :accessLevel` : '1=1', { accessLevel })
			.take(limit)
			.skip(offset);

		return query.getManyAndCount();
	}
}
