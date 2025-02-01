import UserEntity from '@entity/user.entity';
import { EntitySubscriberInterface, EventSubscriber, UpdateEvent } from 'typeorm';
import Socket from '@src/socket';
import SocketEventsType from 'dd-common-blocks/dist/type/SocketEventsType';
import { NODE_ENV } from '@src/config';

@EventSubscriber()
export default class UserSubscriber implements EntitySubscriberInterface<UserEntity> {
	listenTo() {
		return UserEntity;
	}

	async afterUpdate(event: UpdateEvent<UserEntity>) {
		const { entity } = event;

		if (!entity || !entity.id) return;

		if (NODE_ENV !== 'test')
			Socket.connection().sendEventToUser(String(entity.id), SocketEventsType.USER_DATA_UPDATED, {
				message: 'User data changed.',
			});
	}
}
