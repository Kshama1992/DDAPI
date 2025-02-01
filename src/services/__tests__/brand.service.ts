import { faker } from '@faker-js/faker';
import BrandEntity from '@src/entity/brand.entity';
import BrandService from '@services/brand.service';
import { CreateQueryBuilderMock, TestUnitUserSuperAdmin } from '@utils/tests/typeorm.mock';
import MainDataSource from '@src/main-data-source';
import { TestUnitBaseDeleteMethod } from '@utils/tests/base-unit.test';
import UserEntity from '@entity/user.entity';
import { Repository } from 'typeorm/repository/Repository';
import { DEFAULT_BRAND_NAME } from '@src/config';
import BrandCategoryEntity from '@src/entity/brand-category.entity';

let thisService: BrandService;

const item: BrandEntity = {
	id: Number(faker.random.numeric(2)),
	name: faker.lorem.sentence(),
	domain: faker.internet.domainWord(),
	createdAt: new Date(),
	updatedAt: new Date(),
	chargeCustomer: true,
	_canDelete(user: UserEntity | undefined): boolean {
		return true;
	},
	brandCategories: []
};
const itemBrandCategory: BrandCategoryEntity = {
	id: Number(faker.random.numeric(2)),
	categoryName: faker.lorem.sentence(),
	url: faker.internet.url(),
	iconFileID: Number(faker.random.numeric(2)),
	createdAt: new Date(),
	updatedAt: new Date(),
	subCategories:[]
}

describe('SERVICE: Brand Service', () => {
	let repo: Repository<BrandEntity>;
	let repoBrandCategory: Repository<BrandCategoryEntity>;

	beforeAll(() => {
		thisService = new BrandService();
	});

	beforeEach(() => {
		repo = MainDataSource.getRepository(BrandEntity);
		repo.createQueryBuilder = CreateQueryBuilderMock(item);
	});

	describe('method "single"', () => {
		it('calls repository with correct params', async () => {
			const findOneOrFailSpy = jest.spyOn(repo, 'findOneOrFail').mockImplementation(async () => {
				return Promise.resolve(item);
			});

			const result = await thisService.single(item.id, TestUnitUserSuperAdmin);

			expect(findOneOrFailSpy).toBeCalled();
			expect(findOneOrFailSpy).toBeCalledWith({
				where: { id: Number(item.id) },
				relations: { background: true, logo: true },
				select: {
					id: true,
					unlayerPP: true,
					unlayerTOS: true,
					privacyPolicy: true,
					userTerms: true,
					chargeCustomer: true,
					stripePrivateKey: true,
					stripePublicKey: true,
					domain: true,
					name: true,
				},
			});

			expect(result).toEqual(item);
		});
	});

	describe('method "getDefaultBrand"', () => {
		it('calls repository with correct params', async () => {
			const findOneOrFailSpy = jest.spyOn(repo, 'findOneOrFail').mockImplementation(async () => {
				return Promise.resolve(item);
			});

			const result = await thisService.getDefaultBrand();

			expect(findOneOrFailSpy).toBeCalled();
			expect(findOneOrFailSpy).toBeCalledWith({ where: { name: DEFAULT_BRAND_NAME }, cache: true });

			expect(result).toEqual(item);
		});
	});

	describe('method "create"', () => {
		// todo: cover file uploads
		it('create new brand', async () => {
			const createSpy = jest.spyOn(repo as any, 'create').mockResolvedValue(item);
			const saveSpy = jest.spyOn(repo as any, 'save').mockResolvedValue(Promise.resolve(item));
			const thisServiceSingleSpy = jest.spyOn(thisService, 'single').mockResolvedValue(Promise.resolve(item));

			const result = await thisService.create(item, TestUnitUserSuperAdmin);

			expect(createSpy).toBeCalled();
			expect(createSpy).toBeCalledWith(item);

			expect(saveSpy).toBeCalled();

			expect(thisServiceSingleSpy).toBeCalled();
			expect(thisServiceSingleSpy).toBeCalledWith(item.id, TestUnitUserSuperAdmin);

			expect(result).toEqual(item);
		});
	});

	describe('method "update"', () => {
		// todo: cover file uploads
		it('update brand', async () => {
			const saveSpy = jest.spyOn(repo as any, 'save').mockResolvedValue(Promise.resolve(item));
			const thisServiceSingleSpy = jest.spyOn(thisService, 'single').mockResolvedValue(Promise.resolve(item));

			const updateData = {
				name: faker.lorem.sentence(2),
			};
			const result = await thisService.update(item.id, updateData, TestUnitUserSuperAdmin);

			expect(saveSpy).toBeCalled();
			expect(saveSpy).toBeCalledWith({ ...updateData, id: item.id });

			expect(thisServiceSingleSpy).toBeCalled();
			expect(thisServiceSingleSpy).toBeCalledWith(item.id, TestUnitUserSuperAdmin);

			expect(result).toEqual(item);
		});
	});

	describe('method "getDefaultBrandDetail"', () => {
		it('calls repository with correct params', async () => {
			const findOneOrFailSpy = jest.spyOn(repo, 'findOneOrFail').mockImplementation(async () => {
				return Promise.resolve(item);
			});

			const result = await thisService.getDefaultBrandDetail();

			expect(findOneOrFailSpy).toBeCalled();
			expect(findOneOrFailSpy).toBeCalledWith({ where: { name: DEFAULT_BRAND_NAME }, cache: true });

			expect(result).toEqual(item);
		});
	});

	describe('method "delete"', () => {
		it('delete brand with no users', async () => {
			await TestUnitBaseDeleteMethod({ entity: BrandEntity, id: 1, service: thisService, data: item });
		});
	});

	describe('method "list"', () => {
		it('list all brands by brand and type as member', async () => {
			const params = { domain: 'test-brand', limit: 15, offset: 10, searchString: 'test' };
			const result = await thisService.list(params);

			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenCalled();
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(1, 'Brand.logo', 'logo');
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(2, 'Brand.background', 'background');

			expect(repo.createQueryBuilder().where).toHaveBeenCalled();
			expect(repo.createQueryBuilder().where).toHaveBeenCalledWith(`LOWER(Brand.name) LIKE LOWER(:searchString)`, {
				searchString: `%${params.searchString}%`,
			});

			expect(repo.createQueryBuilder().andWhere).toHaveBeenCalledTimes(2);
			expect(repo.createQueryBuilder().andWhere).toHaveBeenNthCalledWith(1, `LOWER(Brand.domain) LIKE LOWER(:domain)`, {
				domain: `%${params.domain}%`,
			});
			expect(repo.createQueryBuilder().andWhere).toHaveBeenNthCalledWith(2, `Brand.name NOT LIKE '%SuperAdmin%'`);

			expect(repo.createQueryBuilder().take).toHaveBeenCalled();
			expect(repo.createQueryBuilder().take).toHaveBeenCalledWith(params.limit);

			expect(repo.createQueryBuilder().skip).toHaveBeenCalled();
			expect(repo.createQueryBuilder().skip).toHaveBeenCalledWith(params.offset);

			expect(result).toEqual([[item], 1]);
		});

		it('list all brands by brand and type as super admin', async () => {
			const params = { domain: 'test-brand', limit: 15, offset: 10, searchString: 'test' };
			const result = await thisService.list(params, TestUnitUserSuperAdmin);

			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenCalled();
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(1, 'Brand.logo', 'logo');
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(2, 'Brand.background', 'background');

			expect(repo.createQueryBuilder().where).toHaveBeenCalled();
			expect(repo.createQueryBuilder().where).toHaveBeenCalledWith(`LOWER(Brand.name) LIKE LOWER(:searchString)`, {
				searchString: `%${params.searchString}%`,
			});

			expect(repo.createQueryBuilder().andWhere).toHaveBeenCalledTimes(1);
			expect(repo.createQueryBuilder().andWhere).toHaveBeenNthCalledWith(1, `LOWER(Brand.domain) LIKE LOWER(:domain)`, {
				domain: `%${params.domain}%`,
			});

			expect(repo.createQueryBuilder().take).toHaveBeenCalled();
			expect(repo.createQueryBuilder().take).toHaveBeenCalledWith(params.limit);

			expect(repo.createQueryBuilder().skip).toHaveBeenCalled();
			expect(repo.createQueryBuilder().skip).toHaveBeenCalledWith(params.offset);

			expect(result).toEqual([[item], 1]);
		});
	});
	describe('listBrandCategories- lists a', () => {	
	  
		beforeEach(() => {
			repoBrandCategory = MainDataSource.getRepository(BrandCategoryEntity);
			repoBrandCategory.createQueryBuilder = CreateQueryBuilderMock(itemBrandCategory);
		});
	  
		it('should return a list of brand categories and their count', async () => {
		  const mockBrandCategories = [
			new BrandCategoryEntity(),
			new BrandCategoryEntity(),
		  ];
		  const mockCount = 2;
	  
		  const result = await thisService.listBrandCategories();
	  
		  expect(result).toEqual([mockBrandCategories, mockCount]);
		  expect(MainDataSource.getRepository).toHaveBeenCalledWith(BrandCategoryEntity);
		  expect(repoBrandCategory.createQueryBuilder).toHaveBeenCalledWith('BrandCategory');
		  expect(repoBrandCategory.createQueryBuilder().leftJoinAndSelect).toHaveBeenCalledWith('BrandCategory.icon', 'icon');
		  expect(repoBrandCategory.createQueryBuilder().leftJoinAndSelect).toHaveBeenCalledWith('BrandCategory.subCategories', 'subCategories');
		  expect(repoBrandCategory.createQueryBuilder().select).toHaveBeenCalledWith(['BrandCategory.id', 'BrandCategory.categoryName', 'BrandCategory.iconFileID','BrandCategory.url', 'icon', 'subCategories']);
		  expect(repoBrandCategory.createQueryBuilder().getManyAndCount).toHaveBeenCalled();

		  expect(result).toEqual([[itemBrandCategory], 1]);
		});
	  });
});
