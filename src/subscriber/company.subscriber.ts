import { EntitySubscriberInterface, EventSubscriber, UpdateEvent } from 'typeorm';
import CompanyEntity from '@entity/company.entity';
import FileEntity from '@entity/file.entity';

@EventSubscriber()
export default class SpaceSubscriber implements EntitySubscriberInterface<CompanyEntity> {
	listenTo() {
		return CompanyEntity;
	}

	public async afterUpdate(e: UpdateEvent<CompanyEntity>): Promise<void> {
		const { entity, databaseEntity, manager } = e;
		if (!entity) return;
		const hasDeletedPhotos = databaseEntity.photos.length > entity.photos.length;

		if (hasDeletedPhotos) {
			const filesToDelete = databaseEntity.photos.filter((p) => !entity.photos.map((ep: FileEntity) => ep.id).includes(p.id));
			await manager.remove(FileEntity, filesToDelete);
		}
	}
}
