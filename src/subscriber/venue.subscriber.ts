import VenueEntity from '@entity/venue.entity';
import VenueStatus from 'dd-common-blocks/dist/type/VenueStatus';
import { EntitySubscriberInterface, EventSubscriber, UpdateEvent } from 'typeorm';
import FileEntity from '@entity/file.entity';
import { ForbiddenResponse } from '@utils/response/forbidden.response';

@EventSubscriber()
export default class VenueSubscriber implements EntitySubscriberInterface<VenueEntity> {
	listenTo() {
		return VenueEntity;
	}

	public async afterUpdate(e: UpdateEvent<VenueEntity>): Promise<void> {
		const { entity, databaseEntity, manager } = e;
		if (!entity) return;
		const hasDeletedPhotos = databaseEntity.photos && databaseEntity.photos.length > entity.photos.length;

		if (hasDeletedPhotos) {
			const filesToDelete = databaseEntity.photos.filter((p) => !entity.photos.map((ep: FileEntity) => ep.id).includes(p.id));
			await manager.remove(FileEntity, filesToDelete);
		}
	}

	async beforeUpdate(e: UpdateEvent<VenueEntity>): Promise<void> {
		const { databaseEntity } = e;
		// 	// @ts-ignore
		// 	const newData: VenueEntity = e.entity;
		// const oldData: VenueEntity = e.databaseEntity;

		if (databaseEntity.status === VenueStatus.DELETED) throw new ForbiddenResponse({ message: 'Venue deleted. No edit allowed.' });

		// 	if (newData.status !== oldData.status && newData.status === VenueStatus.DELETED) {
		// 		const venService = new VenueService();
		// 		await venService.delete(String(oldData.id));
		// 	}
	}
}
