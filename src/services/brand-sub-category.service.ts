import BaseService from '@services/base.service';
import { Service } from 'typedi';
import MainDataSource from '@src/main-data-source';
import BrandSubCategory from '@src/entity/brand-sub-category.entity';
import winstonLogger from '@src/utils/helpers/winston-logger';
import UserEntity from '@src/entity/user.entity';

@Service()
export default class BrandSubCategoryService extends BaseService {
	constructor() {
		super();
		this.entity = BrandSubCategory;
	}
	
	async listBrandSubCategories(): Promise<[BrandSubCategory[],number]> {
		let query = MainDataSource.getRepository(BrandSubCategory)
			.createQueryBuilder('BrandSubCategory')
			.select(['BrandSubCategory.id', 'BrandSubCategory.name'])
		winstonLogger.info('BrandSubCategoryService.listBrandSubCategories: ' , query.getQuery());
		return query.getManyAndCount();
	}    

	async single(id: string | number, requestedByUser?: UserEntity | undefined): Promise<BrandSubCategory> {
		return await MainDataSource.getRepository(BrandSubCategory).findOneOrFail({
			where: { id: Number(id) },
			select: {
				id: true,
				name: true,
			},
		});
	}
  
}
