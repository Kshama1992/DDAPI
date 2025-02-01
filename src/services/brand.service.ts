import BrandEntity from '@entity/brand.entity';
import loggerHelper from '@helpers/logger.helper';
import { prepareImage, uploadToS3 } from '@helpers/s3';
import UserEntity from '@entity/user.entity';
import * as CryptoJS from 'crypto-js';
import { ForbiddenResponse } from '@utils/response/forbidden.response';
import BaseService from '@services/base.service';
import { STRIPE_SECRET_KEY ,STRIPE_PUBLISH_KEY, STRIPE_WEBHOOK_SECRET } from '@src/config';//STRIPE_WEBHOOK_SECRET
import { Service } from 'typedi';
import MainDataSource from '@src/main-data-source';
import { DEFAULT_BRAND_NAME } from '@src/config';
// import BrandFilter from '@src/interface/brand.interface';
import type BrandFilterRequest from '@src/dto/brand-filter-request';
import winstonLogger from '@src/utils/helpers/winston-logger';

/**
 * Brand service
 */
@Service()
export default class BrandService extends BaseService {
	constructor() {
		super();
		this.entity = BrandEntity;
	}

	/**
	 * Get single brand
	 * @param {string | number} id - Brand ID
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async single(id: string | number, requestedByUser?: UserEntity | undefined): Promise<BrandEntity> {
		const brand = await MainDataSource.getRepository(BrandEntity).findOneOrFail({
			where: { id: Number(id) },
			relations: { background: true, logo: true, brandCategories: true },
			select: {
				id: true,
				unlayerPP: requestedByUser?.isAdmin,
				unlayerTOS: requestedByUser?.isAdmin,
				privacyPolicy: requestedByUser?.isAdmin,
				userTerms: requestedByUser?.isAdmin,
				chargeCustomer: requestedByUser?.isAdmin,
				stripePrivateKey: requestedByUser?.isAdmin,
				stripePublicKey: requestedByUser?.isAdmin,
				stripewebhooksecret: requestedByUser?.isAdmin,
				domain: requestedByUser?.isAdmin,
				name: true,
			},
		});

		if (requestedByUser?.isSuperAdmin() || (requestedByUser?.isAdmin && requestedByUser.brandId === brand.id)) return brand;

		throw new ForbiddenResponse();
	}

	getDefaultBrand() {
		return MainDataSource.getRepository(BrandEntity).findOneOrFail({ where: { name: DEFAULT_BRAND_NAME }, cache: true });
	}

	/**
	 * Update single brand
	 * @param id
	 * @param data
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async update(id: number, data: Partial<BrandEntity>, requestedByUser?: UserEntity | undefined): Promise<BrandEntity> {
		const clone = data;
		// @ts-ignore
		delete clone.updatedById;

		if (clone.uploadLogo) {
			try {
				const image64 = await prepareImage(clone.uploadLogo, 1024);
				clone.logo = await uploadToS3(image64, 'brand', String(id), String(new Date().valueOf()));
				delete clone.uploadLogo;
			} catch (e) {
				loggerHelper.error('logo saving failed - ', e);
			}
		}

		if (clone.uploadBg) {
			try {
				const image64 = await prepareImage(clone.uploadBg, 1024);
				clone.background = await uploadToS3(image64, 'brand', String(id), String(new Date().valueOf()));
				delete clone.uploadBg;
			} catch (e) {
				loggerHelper.error('background saving failed - ', e);
			}
		}
		if (clone.stripewebhooksecret) {
			try {
				clone.stripewebhooksecret = CryptoJS.AES.encrypt(clone.stripewebhooksecret,'').toString();
			} catch (e) {
				loggerHelper.error('Webhook secret encrypt failed - ', e);
			}
		}
		if(data.chargeCustomer){
			if(data.stripePrivateKey == null || data.stripePrivateKey == ''  ){
				clone.stripePrivateKey = STRIPE_SECRET_KEY;
				clone.stripewebhooksecret = CryptoJS.AES.encrypt(STRIPE_WEBHOOK_SECRET.toString(),'').toString();//STRIPE_WEBHOOK_SECRET;
			}if(data.stripePublicKey == null || data.stripePublicKey == '' ){
				clone.stripePublicKey = STRIPE_PUBLISH_KEY;
			}
			}
		await MainDataSource.getRepository(BrandEntity).save({ ...clone, id: Number(id) });
		return this.single(id, requestedByUser);
	}

	async getDefaultBrandDetail():  Promise<BrandEntity | Error> {
		const data = await MainDataSource.getRepository(BrandEntity).findOneOrFail({ where: { name: DEFAULT_BRAND_NAME }, cache: true });
		return data;
	}

	/**
	 * Create single brand
	 * @param data
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async create(data: Partial<BrandEntity>, requestedByUser?: UserEntity | undefined): Promise<BrandEntity> {
		if (!requestedByUser || !requestedByUser.isSuperAdmin()) throw new ForbiddenResponse();
		const cloneData = data;
		const { uploadLogo, uploadBg } = cloneData;
		delete cloneData.uploadBg;
		delete cloneData.uploadLogo;
		if(data.chargeCustomer){
		if (cloneData.stripewebhooksecret) {
				try {
					cloneData.stripewebhooksecret = CryptoJS.AES.encrypt(cloneData.stripewebhooksecret,'').toString();
				} catch (e) {
					loggerHelper.error('Webhook secret encrypt failed - ', e);
				}
		}
		if(data.stripePrivateKey == null || data.stripePrivateKey == ''  ){
			cloneData.stripePrivateKey = STRIPE_SECRET_KEY;
			cloneData.stripewebhooksecret = CryptoJS.AES.encrypt(STRIPE_WEBHOOK_SECRET.toString(),'').toString();
		}if(data.stripePublicKey == null || data.stripePublicKey == '' ){
			cloneData.stripePublicKey = STRIPE_PUBLISH_KEY;
		}
		}
		const newBrand = MainDataSource.getRepository(BrandEntity).create(cloneData);
		if (uploadLogo) {
			try {
				const image64 = await prepareImage(uploadLogo, 128);
				newBrand.logo = await uploadToS3(image64, 'brand', String(newBrand.id), String(new Date().valueOf()));
			} catch (e) {
				loggerHelper.error('logo saving failed - ', e);
			}
		}
		

		if (uploadBg) {
			try {
				const image64 = await prepareImage(uploadBg, 1024);
				newBrand.background = await uploadToS3(image64, 'brand', String(newBrand.id), String(new Date().valueOf()));
			} catch (e) {
				loggerHelper.error('bg saving failed - ', e);
			}
		}
		const savedBrand = await MainDataSource.getRepository(BrandEntity).save(newBrand);
		return this.single(savedBrand.id, requestedByUser);
	}

	/**
	 * Get brands list with filter
	 * @param {string | undefined} params
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async list(params: BrandFilterRequest, requestedByUser?: UserEntity | undefined): Promise<[BrandEntity[], number]> {
		const { domain, searchString, limit = 10, offset = 0, includeIds } = params;
		let query = MainDataSource.getRepository(BrandEntity)
			.createQueryBuilder('Brand')
			.leftJoinAndSelect('Brand.logo', 'logo')
			.leftJoinAndSelect('Brand.background', 'background')
			.where(searchString ? `LOWER(Brand.name) LIKE LOWER(:searchString)` : '1=1', { searchString: `%${searchString}%` })
			.andWhere(domain ? `LOWER(Brand.domain) LIKE LOWER(:domain)` : '1=1', { domain: `%${domain}%` })
			.select(['Brand.chargeCustomer', 'Brand.domain', 'Brand.name', 'Brand.id', 'logo.url', 'background.url']);

			winstonLogger.info('BrandService.list: ' , query.getQuery());
			if(params.name){
				query = query.andWhere('Brand.name = :name', { name: params.name });
				winstonLogger.info('BrandService.list updated query: ' , query.getQuery());
			}
		if (searchString && !isNaN(parseInt(searchString))){
			const searchint = parseInt(searchString);
			query = query.orWhere(searchint ? `Brand.id = :searchint` : '1=1', { searchint });
			winstonLogger.info('BrandService.list updated query: ' , query.getQuery());
		}			

		if (includeIds) {
			query = query.andWhere('Brand.id IN (:...includeIds)', { includeIds });
			winstonLogger.info('BrandService.list updated: ' , query.getQuery());
		}

		return query.take(limit).skip(offset).getManyAndCount();
	}
}
