import BrandSubCategoryService from '../brand-sub-category.service';
import MainDataSource from '@src/main-data-source';
import BrandSubCategory from '@src/entity/brand-sub-category.entity';

jest.mock('@src/main-data-source'); 

describe('BrandSubCategoryService', () => {
    let brandSubCategoryService: BrandSubCategoryService;

    beforeEach(() => {
        brandSubCategoryService = new BrandSubCategoryService();
    });

    describe('listBrandSubCategories', () => {
        it('should return an array of BrandSubCategory and count', async () => {
            const mockBrandSubCategories: BrandSubCategory[] = [
                { id: 1, name: 'Sub Category 1' },
                { id: 2, name: 'Sub Category 2' }
            ];
            const mockCount = 2;

            const mockGetManyAndCount = jest.fn().mockResolvedValue([mockBrandSubCategories, mockCount]);
            const mockCreateQueryBuilder = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnThis(),
                getManyAndCount: mockGetManyAndCount
            });
            jest.spyOn(MainDataSource.getRepository(BrandSubCategory), 'createQueryBuilder').mockReturnValue(mockCreateQueryBuilder());

            const result = await brandSubCategoryService.listBrandSubCategories();
            expect(result).toEqual([mockBrandSubCategories, mockCount]);
        });
    });
});
