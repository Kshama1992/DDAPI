import FileEntity from '@entity/file.entity';
import { Service } from 'typedi';
import MainDataSource from '@src/main-data-source';

/**
 * File service
 */
@Service()
export default class FileService {
	/**
	 * Get single file
	 * @param id
	 */
	async single(id: number): Promise<FileEntity | undefined> {
		return MainDataSource.getRepository(FileEntity).findOneOrFail({ where: { id } });
	}

	/**
	 * Create single file
	 * @param data
	 */
	async create(data: Partial<FileEntity>): Promise<FileEntity> {
		const newFile = MainDataSource.getRepository(FileEntity).create(data);
		return await MainDataSource.getRepository(FileEntity).save(newFile);
	}

	async delete(id: number): Promise<FileEntity> {
		const repo = MainDataSource.getRepository(FileEntity);
		const item = await repo.findOneOrFail({ where: { id } });
		await repo.remove(item);
		return item;
	}
}
