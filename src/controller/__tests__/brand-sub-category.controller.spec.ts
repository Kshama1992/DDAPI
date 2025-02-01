import { BrandCategoryController } from '../brand-sub-category.controller';
import BrandSubCategoryService from '@services/brand-sub-category.service';
import BrandSubCategory from '@src/entity/brand-sub-category.entity';
import { SuccessResponse } from '@src/utils/response/success.response';

describe('BrandCategoryController', () => {
    let brandCategoryController: BrandCategoryController;
    let brandSubCategoryService: BrandSubCategoryService;

    beforeEach(() => {
        brandSubCategoryService = new BrandSubCategoryService();
        brandCategoryController = new BrandCategoryController();
        brandCategoryController.service = brandSubCategoryService;
    });

    it('should be defined', () => {
        expect(brandCategoryController).toBeDefined();
    });

    describe('getBrandSubCategories', () => {       

        it('should return a SuccessResponse with brand sub-categories', async () => {
            const mockBrandSubCategories : BrandSubCategory[] =[{ id: 1, name: 'Sub Category 1' }, { id: 2, name: 'Sub Category 2' }];
            jest.spyOn(brandSubCategoryService, 'listBrandSubCategories').mockResolvedValueOnce([mockBrandSubCategories, mockBrandSubCategories.length]);

            const result = await brandCategoryController.getBrandSubCategories();
            expect(result).toBeInstanceOf(SuccessResponse);
            expect(result.data).toEqual(mockBrandSubCategories);
        });
    });
});
