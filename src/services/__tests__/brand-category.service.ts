import BrandCategoryService from '../brand-category.service';
import MainDataSource from '@src/main-data-source';
import BrandCategory from '@src/entity/brand-category.entity';
import UserEntity from '@src/entity/user.entity';
import { ForbiddenResponse } from '@src/utils/response/forbidden.response';

jest.mock('@src/main-data-source'); 

const id = 1;
const mockData: Partial<BrandCategory> = {
    categoryName: 'New Category',
    iconFileID: 26226,
    url: "https://test8/test8",
    subCategories: [
        {
        id: 17,
        name: "Recording Studio"
        },
        {
            "id": 16,
            "name": "Podcast Studio"
        },
        {
            "id": 30,
            "name": "Meetup"
        },
        {
            "id": 15,
            "name": "Board Room"
        }
    ]
};

describe('BrandCategoryService', () => {
    let brandCategoryService: BrandCategoryService;

    beforeEach(() => {
        brandCategoryService = new BrandCategoryService();
    });

    describe('listBrandCategories', () => {
        it('should return an array of BrandCategory and count', async () => {
            const mockBrandCategories: BrandCategory[] = [
                { id: 1, categoryName: 'Category 1', iconFileID: 1, url: 'category-1',  subCategories: [] },
                { id: 2, categoryName: 'Category 2', iconFileID: 2, url: 'category-2',  subCategories: [] }
            ];
            const mockCount = 2;

            const mockGetManyAndCount = jest.fn().mockResolvedValue([mockBrandCategories, mockCount]);
            const mockCreateQueryBuilder = jest.fn().mockReturnValue({
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                getManyAndCount: mockGetManyAndCount
            });
            jest.spyOn(MainDataSource.getRepository(BrandCategory), 'createQueryBuilder').mockReturnValue(mockCreateQueryBuilder());

            const result = await brandCategoryService.listBrandCategories();
            expect(result).toEqual([mockBrandCategories, mockCount]);
        });
    });

    describe('create', () => {
        it('should create a new BrandCategory', async () => {
            
            const mockRequestedByUser: UserEntity = new UserEntity(); 

            jest.spyOn(MainDataSource.getRepository(BrandCategory), 'create').mockReturnValue(mockData as BrandCategory);
            jest.spyOn(MainDataSource.getRepository(BrandCategory), 'save').mockResolvedValue({ id: 1, ...mockData } as BrandCategory);

            jest.spyOn(brandCategoryService, 'single').mockResolvedValue(mockData as BrandCategory); // Mocking single method

            const result = await brandCategoryService.create(mockData, mockRequestedByUser);
            expect(result).toEqual(mockData as BrandCategory);
        });

        it('should throw ForbiddenResponse if user is not authorized', async () => {
            
            const unauthorizedUser: UserEntity = new UserEntity(); // Mocking unauthorized user

            await expect(brandCategoryService.create(mockData, unauthorizedUser)).rejects.toThrow(ForbiddenResponse);
        });
    });

    describe('update', () => {
        it('should update an existing BrandCategory', async () => {
           
            
            const mockRequestedByUser: UserEntity = new UserEntity(); 

            jest.spyOn(MainDataSource.getRepository(BrandCategory), 'save').mockResolvedValue({ id, ...mockData } as BrandCategory);
            jest.spyOn(brandCategoryService, 'single').mockResolvedValue({ id, ...mockData } as BrandCategory); // Mocking single method

            const result = await brandCategoryService.update(id, mockData, mockRequestedByUser);
            expect(result).toEqual({ id, ...mockData } as BrandCategory);
        });

        it('should handle icon upload during update', async () => {
            const id = 1;
            const mockData: Partial<BrandCategory> = {
                categoryName: 'Updated Category',
                uploadIcon: 'base64ImageMock'
            };
            const mockRequestedByUser: UserEntity = new UserEntity();
            const result = await brandCategoryService.update(id, mockData, mockRequestedByUser);
            expect(result).toEqual({ id, ...mockData } as BrandCategory);
        });
    });
});
