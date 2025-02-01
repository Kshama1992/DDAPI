import { EntitySubscriberInterface, EventSubscriber, RemoveEvent } from 'typeorm';
import FileEntity from '@entity/file.entity';
import { deleteFromS3 } from '@helpers/s3';

@EventSubscriber()
export default class FileSubscriber implements EntitySubscriberInterface<FileEntity> {
	listenTo() {
		return FileEntity;
	}

	async afterRemove(e: RemoveEvent<FileEntity>): Promise<void> {
		const file = e.databaseEntity;
		await deleteFromS3(file.url);
	}
}
