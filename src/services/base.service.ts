import { Repository } from 'typeorm/repository/Repository';
import { DeleteResult } from 'typeorm';
import UserEntity from '@entity/user.entity';
import { ForbiddenResponse } from '@utils/response/forbidden.response';
import MainDataSource from '@src/main-data-source';
import { Features } from '../utils/features';

/**
 * Handle all actions with Amenity.
 * @module AmenityService
 * @category Services
 */
export default class BaseService {
	entity: any;
	repo: Repository<any>;
    features: Features;

    constructor() {
        this.features = new Features();
    }

	/**
	 * Status name validator
	 * @param value
	 * @param id
	 */
	async _nameValidator(value: string, id: string | undefined): Promise<boolean | Error> {
		const item: any = await MainDataSource.getRepository(this.entity).findOne({ where: { name: value }, select: ['id', 'name'] });
		if (typeof item === 'undefined' || String(item.id) === String(id)) return true;
		throw new Error(`Item with name ${value} already exist`);
	}

	/**
	 * Get single item
	 * @param {number} id - Item ID
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @param {any} options - Options
	 * @returns {Promise<any>}
	 */
	async single(id: number, requestedByUser?: UserEntity | undefined, options?: any): Promise<any> {
		return await MainDataSource.getRepository(this.entity).findOneOrFail({ where: { id }, ...options });
	}

	/**
	 * Update single item
	 * @param {number} id - Item ID
	 * @param {Partial<any>} data - HTTP request data
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<any>}
	 */
	async update(id: number, data: Partial<any>, requestedByUser?: UserEntity | undefined): Promise<any> {
		await MainDataSource.getRepository(this.entity).findOneOrFail({ where: { id } });
		return MainDataSource.getRepository(this.entity).save({ ...data, id });
	}

	/**
	 * Create single item type
	 * @param {Partial<any>} data
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<any>}
	 */
	async create(data: Partial<any>, requestedByUser?: UserEntity | undefined): Promise<any> {
		return MainDataSource.getRepository(this.entity).save(data);
	}

	/**
	 * Get items list with filter
	 * @param {any | undefined} options
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async list(options?: any, requestedByUser?: UserEntity | undefined): Promise<[any[], number]> {
		return MainDataSource.getRepository(this.entity).findAndCount(options);
	}

	/**
	 * Delete item
	 * @param {string} id
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<DeleteResult>} - deleted result {@link DeleteResult}
	 */
	async delete(id: number, requestedByUser?: UserEntity | undefined): Promise<DeleteResult | any> {
		const item: any = await MainDataSource.getRepository(this.entity).findOneOrFail({ where: { id } });
		if (!item._canDelete!(requestedByUser)) throw new ForbiddenResponse();
		return MainDataSource.getRepository(this.entity).remove(item);
	}
}
