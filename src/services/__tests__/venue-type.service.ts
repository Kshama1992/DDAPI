import VenueTypeService from '@services/venue-type.service';
import VenueTypeEntity from '@entity/venue-type.entity';
import { TestUnitBaseCreateMethod, TestUnitBaseUpdateMethod } from '@utils/tests/base-unit.test';
import UserEntity from '@entity/user.entity';
import { Repository } from 'typeorm/repository/Repository';
import VenueTypeFilter from 'dd-common-blocks/dist/interface/filter/venue-type-filter.interface';
import MainDataSource from '@src/main-data-source';
import { CreateQueryBuilderMock } from '@utils/tests/typeorm.mock';

const item: VenueTypeEntity = {
	id: 1,
	alias: 'test-venue-type',
	name: 'Test venue type',
	createdAt: new Date(),
	updatedAt: new Date(),
	icon: '',
	_canDelete(user: UserEntity | undefined): boolean {
		return true;
	},
};

describe('SERVICE: Venue Type Service', () => {
	let repo: Repository<VenueTypeEntity>;
	let thisService: VenueTypeService;

	beforeAll(() => {
		jest.resetModules();
		thisService = new VenueTypeService();
	});

	beforeEach(() => {
		repo = MainDataSource.getRepository(VenueTypeEntity);
		repo.createQueryBuilder = CreateQueryBuilderMock(item);
	});

	it('list all venue types with valid params', async () => {
		const params: VenueTypeFilter = {
			withParent: true,
			withCache: true,
			withChildren: true,
			onlyChildren: true,
			limit: 20,
			offset: 40,
			brandId: 10,
			alias: 'test-any',
		};
		const result = await thisService.list(params);

		expect(repo.createQueryBuilder().where).toHaveBeenCalled();
		expect(repo.createQueryBuilder().where).toHaveBeenCalledWith(`VenueType.brandId = :brandId`, { brandId: params.brandId });

		expect(repo.createQueryBuilder().andWhere).toHaveBeenCalledTimes(3);
		expect(repo.createQueryBuilder().andWhere).toHaveBeenNthCalledWith(1, `VenueType.alias = :alias`, { alias: params.alias });
		expect(repo.createQueryBuilder().andWhere).toHaveBeenNthCalledWith(2, 'VenueType.parentId IS NULL');
		expect(repo.createQueryBuilder().andWhere).toHaveBeenNthCalledWith(3, 'VenueType.parentId IS NOT NULL');

		expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenCalledTimes(2);
		expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(1, 'VenueType.parent', 'parent');
		expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(2, 'VenueType.children', 'children');

		expect(repo.createQueryBuilder().cache).toHaveBeenCalled();

		expect(repo.createQueryBuilder().take).toHaveBeenCalled();
		expect(repo.createQueryBuilder().take).toHaveBeenCalledWith(params.limit);

		expect(repo.createQueryBuilder().skip).toHaveBeenCalled();
		expect(repo.createQueryBuilder().skip).toHaveBeenCalledWith(params.offset);

		expect(repo.createQueryBuilder().getManyAndCount).toHaveBeenCalled();

		expect(result).toEqual([[item], 1]);
	});

	it('create new venue type', async () => {
		await TestUnitBaseCreateMethod({ service: thisService, obj: item, entity: VenueTypeEntity });
	});

	it('update venue type', async () => {
		await TestUnitBaseUpdateMethod({ service: thisService, obj: item, entity: VenueTypeEntity });
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});
});
