import { EntitySubscriberInterface, EventSubscriber, UpdateEvent } from 'typeorm';
import TeamMemberEntity from '@entity/team-member.entity';
import Socket from '@src/socket';
import SocketEventsType from 'dd-common-blocks/dist/type/SocketEventsType';
import loggerHelper from '@helpers/logger.helper';
import { NODE_ENV } from '@src/config';

@EventSubscriber()
export default class TeamMemberSubscriber implements EntitySubscriberInterface<TeamMemberEntity> {
	listenTo() {
		return TeamMemberEntity;
	}

	public async afterUpdate(e: UpdateEvent<TeamMemberEntity>): Promise<void> {
		const { entity } = e;
		if (!entity || !entity.memberId) return;

		try {
			if (NODE_ENV !== 'test')
				Socket.connection().sendEventToUser(String(entity.memberId), SocketEventsType.USER_SUBSCRIPTION_UPDATED, {
					subscriptionId: entity.id,
					message: `User team membership updated`,
				});
		} catch (e) {
			loggerHelper.error((e as Error).message);
		}
	}
}
