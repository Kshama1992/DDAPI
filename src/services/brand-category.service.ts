import BaseService from '@services/base.service';
import { Service } from 'typedi';
import MainDataSource from '@src/main-data-source';
import BrandCategory from '@src/entity/brand-category.entity';
import loggerHelper from '@src/utils/helpers/logger.helper';
import { ForbiddenResponse } from '@src/utils/response/forbidden.response';
import UserEntity from '@src/entity/user.entity';
import { prepareImage, uploadToS3 } from '@src/utils/helpers/s3';
import winstonLogger from '@src/utils/helpers/winston-logger';

@Service()
export default class BrandCategoryService extends BaseService {
	constructor() {
		super();
		this.entity = BrandCategory;
	}
	
	async listBrandCategories(): Promise<[BrandCategory[],number]> {
		let query = MainDataSource.getRepository(BrandCategory)
			.createQueryBuilder('BrandCategory')
			.leftJoinAndSelect('BrandCategory.icon', 'icon')
			.leftJoinAndSelect('BrandCategory.subCategories', 'subCategories')	
			.orderBy('BrandCategory.id', 'DESC')		
			.select(['BrandCategory.id', 'BrandCategory.categoryName', 'BrandCategory.iconFileID','BrandCategory.url', 'icon', 'subCategories']);	

			winstonLogger.info('BrandCategoryService.listBrandCategories: ' , query.getQuery());
		return query.getManyAndCount();
	}
	

    async create(data: Partial<BrandCategory>, requestedByUser?: UserEntity | undefined): Promise<BrandCategory> {
		if (!requestedByUser || !requestedByUser.isSuperAdmin()) throw new ForbiddenResponse();
		const cloneData = data;
		const { uploadIcon } = cloneData;
		delete cloneData.uploadIcon;
		
		const newBrandCategoryobj = MainDataSource.getRepository(BrandCategory).create(cloneData);
		let newBrandCategory = await MainDataSource.getRepository(BrandCategory).save(newBrandCategoryobj);
		if (uploadIcon) {
			try {
				const image64 = await prepareImage(uploadIcon, 128);
				newBrandCategory.iconFileID = 0;
				newBrandCategory.iconFileID = (await uploadToS3(image64, 'brandCategory', String(newBrandCategory.id), String(new Date().valueOf()))).id;
				newBrandCategory = await MainDataSource.getRepository(BrandCategory).save(newBrandCategory);
			} catch (e) {
				loggerHelper.error('icon saving failed - ', e);
			}

		}
		
		return this.single(Number(newBrandCategory.id), requestedByUser);
	}

	async update(id: number, data: Partial<BrandCategory>, requestedByUser?: UserEntity | undefined): Promise<BrandCategory> {
		const clone = data;
	
		if (clone.uploadIcon) {
			try {
				const image64 = await prepareImage(clone.uploadIcon, 1024);
				clone.icon = await uploadToS3(image64, 'brandCategory', String(id), String(new Date().valueOf()));
				delete clone.uploadIcon;
			} catch (e) {
				loggerHelper.error('background saving failed - ', e);
			}
		}	
		
		await MainDataSource.getRepository(BrandCategory).save({ ...clone, id: Number(id) });
		return this.single(id, requestedByUser);
	}
	
}
