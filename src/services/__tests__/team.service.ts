import { faker } from '@faker-js/faker';
import TeamEntity from '@entity/team.entity';
import TeamService from '@services/team.service';
import { Repository } from 'typeorm/repository/Repository';
import MainDataSource from '@src/main-data-source';
import { CreateQueryBuilderMock } from '@utils/tests/typeorm.mock';
import TeamFilter from 'dd-common-blocks/dist/interface/filter/team-filter.interface';

jest.mock('@utils/helpers/send-mail.helper');

const item: TeamEntity = {
	id: 1,
	name: 'Test item',
	createdAt: new Date(),
	updatedAt: new Date(),
	brandId: 10,
	teamLeadId: 10,
	createdById: 10,
	subscriptions: [],
	members: [],
};

let thisService: TeamService;

describe('SERVICE: Team Service', () => {
	let repo: Repository<TeamEntity>;

	beforeAll(() => {
		thisService = new TeamService();
	});

	beforeEach(() => {
		repo = MainDataSource.getRepository(TeamEntity);
		repo.createQueryBuilder = CreateQueryBuilderMock(item);
	});

	it('get single item', async () => {
		const itemId = Number(faker.random.numeric(2));

		const findOneOrFailSpy = jest.spyOn(MainDataSource.getRepository(TeamEntity), 'findOneOrFail').mockResolvedValue(item);

		const result = await thisService.single(itemId);

		expect(findOneOrFailSpy).toBeCalled();
		expect(findOneOrFailSpy).toBeCalledWith({
			where: { id: itemId },
			relations: [
				'brand',
				'teamLead',
				'subscriptions',
				'companies',
				'members',
				'members.member',
				'subscriptions.creditsRotation',
				'subscriptions.creditHours',
				'subscriptions.spaceTypes',
				'subscriptions.brands',
				'subscriptions.venues',
				'subscriptions.teams',
				'subscriptions.venueTypes',
				'subscriptions.brand',
				'subscriptions.venue',
				'subscriptions.space',
			],
		});

		expect(result).toEqual(item);
	});

	it('list all items with all params', async () => {
		const params: TeamFilter = {
			brandId: Number(faker.random.numeric(2)),
			teamLeadId: Number(faker.random.numeric(2)),
			searchString: faker.lorem.words(2),
			limit: Number(faker.random.numeric(2)),
			offset: Number(faker.random.numeric(2)),
		};
		const result = await thisService.list(params);

		expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenCalledTimes(6);
		expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(1, 'Team.teamLead', 'teamLead');
		expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(2, 'Team.brand', 'brand');
		expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(3, 'Team.createdBy', 'createdBy');
		expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(4, 'Team.members', 'members');
		expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(5, 'members.member', 'membersUser');
		expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(6, 'Team.subscriptions', 'subscriptions');

		expect(repo.createQueryBuilder().andWhere).toHaveBeenCalledTimes(3);
		expect(repo.createQueryBuilder().andWhere).toHaveBeenNthCalledWith(1, `Team.teamLeadId= :teamLeadId`, {
			teamLeadId: params.teamLeadId,
		});

		expect(repo.createQueryBuilder().andWhere).toHaveBeenNthCalledWith(2, `Team.brandId= :brandId`, { brandId: params.brandId });
		expect(repo.createQueryBuilder().andWhere).toHaveBeenNthCalledWith(3, `LOWER(Team.name) LIKE LOWER(:searchString)`, {
			searchString: `%${params.searchString}%`,
		});

		expect(repo.createQueryBuilder().take).toHaveBeenCalled();
		expect(repo.createQueryBuilder().take).toHaveBeenCalledWith(params.limit);
		expect(repo.createQueryBuilder().skip).toHaveBeenCalled();
		expect(repo.createQueryBuilder().skip).toHaveBeenCalledWith(params.offset);

		expect(repo.createQueryBuilder().getManyAndCount).toHaveBeenCalled();

		expect(result).toEqual([[item], 1]);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});
});
