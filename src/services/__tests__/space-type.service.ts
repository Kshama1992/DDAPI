import { faker } from '@faker-js/faker';
import SpaceTypeLogicType from 'dd-common-blocks/dist/type/SpaceTypeLogicType';
import SpaceTypeEntity from '@entity/space-type.entity';
import SpaceEntity from '@entity/space.entity';
import SpaceTypeService from '@services/space-type.service';
import { TestUnitBaseCreateMethod, TestUnitBaseUpdateMethod } from '@utils/tests/base-unit.test';
import MainDataSource from '@src/main-data-source';
import { TestBrand, TestUserBrandAdmin, TestUserBrandMember } from '@utils/tests/base-data';
import UserEntity from '@entity/user.entity';
import { Repository } from 'typeorm/repository/Repository';
import { CreateQueryBuilderMock } from '@utils/tests/typeorm.mock';
import SpaceTypeFilter from 'dd-common-blocks/dist/interface/filter/space-type-filter.interface';
import BrandService from '@services/brand.service';
import { UserService } from '@src/services';

jest.mock('@services/brand.service');
jest.mock('@services/user.service');
jest.mock('@services/invoice.service');

let thisService: SpaceTypeService;
let brandService: BrandService;

const item: SpaceTypeEntity = {
	id: 1,
	alias: 'test-space-type',
	name: 'Test space type',
	createdAt: new Date(),
	updatedAt: new Date(),
	logicType: SpaceTypeLogicType.MINUTELY,
	_canDelete(user: UserEntity | undefined): boolean {
		return true;
	},
};

describe('SERVICE: Space Type Service', () => {
	let repo: Repository<SpaceTypeEntity>;

	beforeAll(() => {
		brandService = new BrandService();
		thisService = new SpaceTypeService(brandService);
	});

	beforeEach(() => {
		repo = MainDataSource.getRepository(SpaceTypeEntity);
		repo.createQueryBuilder = CreateQueryBuilderMock(item);
	});

	describe('method "list"', () => {
		it('list all roles by brand and type as member', async () => {
			const params: SpaceTypeFilter = { brandId: Number(faker.random.numeric(2)), alias: item.alias, withParent: true, withChildren: true };
			const result = await thisService.list(params, TestUserBrandMember);

			const findOneOrFailSpy = jest.spyOn(thisService.brandService as any, 'getDefaultBrand').mockImplementation(async () => {
				return Promise.resolve(TestBrand);
			});
			const getUserSubsSpy = jest.spyOn(UserService as any, '_getSubscriptionsByUserId');

			expect(findOneOrFailSpy).toBeCalled();

			expect(getUserSubsSpy).toBeCalled();
			expect(getUserSubsSpy).toBeCalledWith(TestUserBrandMember.id, ['spaceTypes']);

			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenCalledTimes(2);
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(1, 'SpaceType.parent', 'parent');
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(2, 'SpaceType.children', 'children');

			expect(repo.createQueryBuilder().where).toHaveBeenCalled();
			expect(repo.createQueryBuilder().where).toHaveBeenCalledWith(`SpaceType.brandId = :brandId`, {
				brandId: params.brandId,
			});

			expect(repo.createQueryBuilder().andWhere).toHaveBeenCalledTimes(3);
			expect(repo.createQueryBuilder().andWhere).toHaveBeenNthCalledWith(1, `SpaceType.alias = :alias`, {
				alias: params.alias,
			});

			expect(repo.createQueryBuilder().andWhere).toHaveBeenNthCalledWith(2, 'SpaceType.parentId IS NULL');
			expect(repo.createQueryBuilder().andWhere).toHaveBeenNthCalledWith(3, `SpaceType.alias != :infoName`, { infoName: 'info-space' });

			expect(repo.createQueryBuilder().getManyAndCount).toHaveBeenCalled();

			expect(result).toEqual([[item], 1]);
		});
	});

	describe('method "create"', () => {
		it('create new space type', async () => {
			await TestUnitBaseCreateMethod({ service: thisService, obj: item, entity: SpaceTypeEntity });
		});
	});

	describe('method "update"', () => {
		it('update space type', async () => {
			await TestUnitBaseUpdateMethod({ service: thisService, obj: item, entity: SpaceTypeEntity });
		});
	});

	describe('method "delete"', () => {
		it('delete space type with spaces should throw error', async () => {
			try {
				const findOneOrFailSpy = jest.spyOn(MainDataSource.getRepository(SpaceTypeEntity) as any, 'findOneOrFail').mockResolvedValue(item);

				const countSpy = jest.spyOn(MainDataSource.getRepository(SpaceEntity) as any, 'count').mockImplementation(async () => {
					return Promise.resolve(TestUserBrandAdmin);
				});

				const result = await thisService.delete(item.id, TestUserBrandAdmin);

				expect(countSpy).toBeCalled();
				expect(countSpy).toBeCalledWith({ where: { spaceTypeId: +item.id } });

				expect(findOneOrFailSpy).toBeCalled();
				expect(findOneOrFailSpy).toBeCalledWith({ where: { id: item.id } });

				expect(result).toEqual(item);
			} catch (e) {
				expect((e as Error).message).toBeDefined();
			}
		});

		it('delete space type with no spaces', async () => {
			const findOneOrFailSpy = jest
				.spyOn(MainDataSource.getRepository(SpaceTypeEntity) as any, 'findOneOrFail')
				.mockImplementation(async () => {
					return Promise.resolve(item);
				});

			const countSpy = jest.spyOn(MainDataSource.getRepository(SpaceEntity) as any, 'count').mockImplementation(async () => {
				return Promise.resolve(TestUserBrandAdmin);
			});

			const removeSpy = jest.spyOn(MainDataSource.getRepository(SpaceTypeEntity) as any, 'remove').mockResolvedValue(Promise.resolve(item));

			const result = await thisService.delete(item.id, TestUserBrandAdmin);

			expect(countSpy).toBeCalled();
			expect(countSpy).toBeCalledWith({ where: { spaceTypeId: +item.id } });

			expect(findOneOrFailSpy).toBeCalled();
			expect(findOneOrFailSpy).toBeCalledWith({ where: { id: item.id } });

			expect(removeSpy).toBeCalled();
			expect(removeSpy).toBeCalledWith(item);

			expect(result).toEqual(item);
		});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});
});
