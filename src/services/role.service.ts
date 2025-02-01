import { Brackets, WhereExpressionBuilder } from 'typeorm';
import RoleEntity from '@entity/role.entity';
import UserEntity from '@entity/user.entity';
import RoleFilter from 'dd-common-blocks/dist/interface/filter/role-filter.interface';
import BaseService from '@services/base.service';
import { ForbiddenResponse } from '@utils/response/forbidden.response';
import { Service } from 'typedi';
import MainDataSource from '@src/main-data-source';

/**
 * Role service
 */
@Service()
export default class RoleService extends BaseService {
	constructor() {
		super();
		this.entity = RoleEntity;
	}

	/**
	 * Get single role
	 * @param id
	 */
	async single(id: number): Promise<RoleEntity | undefined> {
		return MainDataSource.getRepository(RoleEntity).findOneOrFail({ where: { id }, relations: ['permissions', 'users'] });
	}

	/**
	 * Get roles list with filter
	 * @param params
	 */
	async list(params: RoleFilter): Promise<[RoleEntity[], number]> {
		const { brandId, type, limit = 10, offset = 0, searchString } = params;

		let query = MainDataSource.getRepository(RoleEntity)
			.createQueryBuilder('Role')
			.leftJoinAndSelect('Role.permissions', 'permissions')
			.leftJoinAndSelect('Role.brand', 'brand')
			.leftJoinAndSelect('Role.users', 'users')
			.where(searchString ? `LOWER(Role.name) LIKE LOWER(:searchString)` : '1=1', { searchString: `%${searchString}%` })
			.andWhere(type ? `Role.roleType IN (:...type)` : '1=1', { type: Array.isArray(type) ? type : [type] })
			.select([
				'Role.id',
				'Role.name',
				'Role.brandId',
				'Role.roleType',
				'brand.id',
				'brand.name',
				'brand.domain',
				'brand.chargeCustomer',
				'permissions.id',
				'permissions.name',
				'permissions.accessLevel',
				'users.id',
				'users.firstname',
				'users.lastname',
			]);

		if (brandId) {
			query = query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => qb.andWhere(`Role.brandId = :brandId`, { brandId }).orWhere(`Role.brandId IS NULL`))
			);
		}

		return await query.take(limit).skip(offset).getManyAndCount();
	}

	async delete(id: number, requestedByUser?: UserEntity | undefined) {
		const countUsers = await MainDataSource.getRepository(UserEntity).count({ where: { roleId: +id } });
		if (countUsers > 0) throw new ForbiddenResponse({ message: 'Cant delete! Role have assigned users!' });

		const item = await MainDataSource.getRepository(RoleEntity).findOneOrFail({ where: { id } });
		if (!item._canDelete!(requestedByUser)) throw new ForbiddenResponse();

		return MainDataSource.getRepository(RoleEntity).remove(item);
	}
}
