import { EntitySubscriberInterface, EventSubscriber, UpdateEvent } from 'typeorm';
import Socket from '@src/socket';
import SocketEventsType from 'dd-common-blocks/dist/type/SocketEventsType';
import { RemoveEvent } from 'typeorm/subscriber/event/RemoveEvent';
import { InsertEvent } from 'typeorm/subscriber/event/InsertEvent';
import TeamMemberEntity from '@entity/team-member.entity';
import TeamMemberStatus from 'dd-common-blocks/dist/type/TeamMemberStatus';
import MainDataSource from '@src/main-data-source';
import { NODE_ENV } from '@src/config';
import SubscriptionCreditHoursEntity from '@entity/subscription-credit-hours.entity';
import TeamEntity from '@entity/team.entity';

@EventSubscriber()
export default class SubscriptionCreditHoursSubscriber implements EntitySubscriberInterface<SubscriptionCreditHoursEntity> {
	listenTo() {
		return SubscriptionCreditHoursEntity;
	}

	async _notifyUser(
		event: UpdateEvent<SubscriptionCreditHoursEntity> | RemoveEvent<SubscriptionCreditHoursEntity> | InsertEvent<SubscriptionCreditHoursEntity>,
		type: string
	): Promise<void> {
		const { entity } = event;

		if (!entity || !entity.id) return;

		const teams = await MainDataSource.getRepository(TeamEntity)
			.createQueryBuilder('t')
			.leftJoinAndSelect('t.members', 'members')
			.leftJoinAndSelect('t.subscriptions', 'subscriptions')
			.where('subscriptions.id = :subId', { subId: entity.subscriptionId })
			.getMany();

		const userIds: number[] = [entity.userId];

		teams.forEach((t) => {
			// userIds.push(t.teamLeadId);
			if (t.members && t.members.length > 0) {
				t.members
					.filter((m) => m.memberId && m.status !== TeamMemberStatus.MEMBER_REMOVED)
					.forEach((m: TeamMemberEntity) => userIds.push(m.memberId!));
			}
		});

		if (NODE_ENV !== 'test')
			await Promise.all(
				userIds.map((id) => {
					Socket.connection().sendEventToUser(String(id), SocketEventsType.USER_SUBSCRIPTION_UPDATED, {
						subscriptionId: entity.id,
						message: `User credit hours ${type}.`,
					});
					return id;
				})
			);
	}

	async afterUpdate(event: UpdateEvent<SubscriptionCreditHoursEntity>): Promise<void> {
		return this._notifyUser(event, 'updated');
	}

	async afterRemove(event: RemoveEvent<SubscriptionCreditHoursEntity>): Promise<void> {
		return this._notifyUser(event, 'removed');
	}
}
