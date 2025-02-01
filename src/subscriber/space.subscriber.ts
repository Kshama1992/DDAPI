import { EntitySubscriberInterface, EventSubscriber, RemoveEvent, UpdateEvent } from 'typeorm';
import SpaceEntity from '@entity/space.entity';
import FileEntity from '@entity/file.entity';
import MainDataSource from '@src/main-data-source';
import SpaceTypeLogicType from 'dd-common-blocks/dist/type/SpaceTypeLogicType';
import { useStripe } from '@helpers/stripe.helper';
import PaymentProvider from 'dd-common-blocks/dist/type/PaymentProvider';

@EventSubscriber()
export default class SpaceSubscriber implements EntitySubscriberInterface<SpaceEntity> {
	space: SpaceEntity;

	listenTo() {
		return SpaceEntity;
	}

	afterLoad(entity: SpaceEntity) {
		this.space = entity;
	}

	public async afterUpdate(e: UpdateEvent<SpaceEntity>): Promise<void> {
		const { entity, databaseEntity, manager } = e;
		if (!entity) return;
		const hasDeletedPhotos = databaseEntity?.photos && databaseEntity.photos.length > entity.photos.length;

		if (hasDeletedPhotos) {
			const filesToDelete = databaseEntity.photos.filter((p) => !entity.photos.map((ep: FileEntity) => ep.id).includes(p.id));
			await manager.remove(FileEntity, filesToDelete);
		}
	}

	public async beforeRemove(event: RemoveEvent<SpaceEntity>) {
		const space = await MainDataSource.getRepository(SpaceEntity).findOneOrFail({
			where: { id: event.entityId },
			relations: ['providerData', 'spaceType'],
		});

		// clear space data from stripe
		if (space.spaceType.logicType === SpaceTypeLogicType.MONTHLY && space.providerData && space.providerData.length) {
			const [stripe] = await useStripe(space.createdById);
			await Promise.all(
				space.providerData.map(async (providerData) => {
					if (providerData.provider === PaymentProvider.STRIPE) await stripe.products.del(providerData.providerItemId);
				})
			);
		}
	}
}
