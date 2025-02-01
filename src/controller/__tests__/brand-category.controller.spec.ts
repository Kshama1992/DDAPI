import { BrandCategoryController } from '../brand-category.controller';
import BrandCategoryService from '@services/brand-category.service';
import BrandCategory from '@src/entity/brand-category.entity';
import { SuccessResponse } from '@src/utils/response/success.response';

describe('BrandCategoryController', () => {
    let brandCategoryController: BrandCategoryController;
    let brandCategoryService: BrandCategoryService;

    beforeEach(() => {
        brandCategoryService = new BrandCategoryService();
        brandCategoryController = new BrandCategoryController();
        brandCategoryController.service = brandCategoryService;
    });

    it('should be defined', () => {
        expect(brandCategoryController).toBeDefined();
    });

    describe('getBrandCategories', () => {       

        it('should return a SuccessResponse with brand categories', async () => {
            const mockBrandCategories : BrandCategory[] = [{
                id: 13,
                categoryName: "test local 8",
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
            },
            {
                id: 12,
                categoryName: "test local 7",
                iconFileID: 26225,
                url: "https://test7/test7",               
                subCategories: [
                    {
                        id: 22,
                        name: "Presentation"
                    },
                    {
                        id: 21,
                        name: "Rehearsal"
                    }
                ]
            }];
            jest.spyOn(brandCategoryService, 'listBrandCategories').mockResolvedValueOnce([mockBrandCategories,mockBrandCategories.length]);

            const result = await brandCategoryController.getBrandCategories();
            expect(result).toBeInstanceOf(SuccessResponse);
            expect(result.data).toEqual(mockBrandCategories);
        });
    });
});