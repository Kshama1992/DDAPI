import { faker } from '@faker-js/faker';
import UserEntity from '@src/entity/user.entity';
import RoleService from '@services/role.service';
import RoleEntity from '@src/entity/role.entity';
import BrandRoleType from 'dd-common-blocks/dist/type/BrandRoleType';
import { TestUnitBaseCreateMethod, TestUnitBaseUpdateMethod } from '@utils/tests/base-unit.test';
import MainDataSource from '@src/main-data-source';
import { TestUserBrandAdmin } from '@utils/tests/base-data';
import { Repository } from 'typeorm/repository/Repository';
import { CreateQueryBuilderMock } from '@utils/tests/typeorm.mock';
import RoleFilter from 'dd-common-blocks/dist/interface/filter/role-filter.interface';

let thisService: RoleService;

const item: RoleEntity = {
	id: 1,
	name: 'Test item',
	createdAt: new Date(),
	updatedAt: new Date(),
	roleType: BrandRoleType.MEMBER,
	_canDelete(user: UserEntity | undefined): boolean {
		return true;
	},
};

describe('SERVICE: Role Service', () => {
	let repo: Repository<RoleEntity>;

	beforeAll(() => {
		thisService = new RoleService();
	});

	beforeEach(() => {
		thisService = new RoleService();
		repo = MainDataSource.getRepository(RoleEntity);
		repo.createQueryBuilder = CreateQueryBuilderMock(item);
	});

	describe('method "single"', () => {
		it('calls repository with correct params', async () => {
			const findOneOrFailSpy = jest.spyOn(MainDataSource.getRepository(RoleEntity) as any, 'findOneOrFail').mockImplementation(async () => {
				return Promise.resolve(item);
			});

			const result = await thisService.single(item.id);

			expect(findOneOrFailSpy).toBeCalled();
			expect(findOneOrFailSpy).toBeCalledWith({
				where: { id: Number(item.id) },
				relations: ['permissions', 'users'],
			});

			expect(result).toEqual(item);
		});
	});

	describe('method "delete"', () => {
		it('delete role with no users', async () => {
			const countSpy = jest.spyOn(MainDataSource.getRepository(UserEntity) as any, 'count').mockImplementation(async () => {
				return Promise.resolve(TestUserBrandAdmin);
			});

			const findOneOrFailSpy = jest.spyOn(MainDataSource.getRepository(RoleEntity) as any, 'findOneOrFail').mockImplementation(async () => {
				return Promise.resolve(item);
			});

			const removeSpy = jest.spyOn(MainDataSource.getRepository(RoleEntity) as any, 'remove').mockResolvedValue(Promise.resolve(item));

			const result = await thisService.delete(item.id, TestUserBrandAdmin);

			expect(countSpy).toBeCalled();
			expect(countSpy).toBeCalledWith({ where: { roleId: +item.id } });

			expect(findOneOrFailSpy).toBeCalled();
			expect(findOneOrFailSpy).toBeCalledWith({ where: { id: +item.id } });

			expect(removeSpy).toBeCalled();
			expect(removeSpy).toBeCalledWith(item);

			expect(result).toEqual(item);
		});
	});

	describe('method "list"', () => {
		it('list all roles by brand and type', async () => {
			const params: RoleFilter = { limit: 30, offset: 20, brandId: '10', type: [BrandRoleType.MEMBER], searchString: faker.lorem.words(2) };
			const result = await thisService.list(params);

			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenCalled();
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(1, 'Role.permissions', 'permissions');
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(2, 'Role.brand', 'brand');
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(3, 'Role.users', 'users');

			expect(repo.createQueryBuilder().where).toHaveBeenCalled();
			expect(repo.createQueryBuilder().where).toHaveBeenCalledWith(`LOWER(Role.name) LIKE LOWER(:searchString)`, {
				searchString: `%${params.searchString}%`,
			});

			expect(repo.createQueryBuilder().andWhere).toHaveBeenCalled();
			expect(repo.createQueryBuilder().andWhere).toHaveBeenNthCalledWith(1, `Role.roleType IN (:...type)`, {
				type: Array.isArray(params.type) ? params.type : [params.type],
			});

			expect(repo.createQueryBuilder().select).toHaveBeenCalled();
			expect(repo.createQueryBuilder().select).toHaveBeenCalledWith([
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

			expect(repo.createQueryBuilder().take).toHaveBeenCalled();
			expect(repo.createQueryBuilder().take).toHaveBeenCalledWith(params.limit);

			expect(repo.createQueryBuilder().skip).toHaveBeenCalled();
			expect(repo.createQueryBuilder().skip).toHaveBeenCalledWith(params.offset);

			expect(result).toEqual([[item], 1]);
		});
	});

	describe('method "create"', () => {
		it('create new item', async () => {
			await TestUnitBaseCreateMethod({ service: thisService, obj: item, entity: RoleEntity });
		});
	});

	describe('method "update"', () => {
		it('update item', async () => {
			await TestUnitBaseUpdateMethod({ service: thisService, obj: item, entity: RoleEntity });
		});
	});
});
