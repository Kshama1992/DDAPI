import { EntitySubscriberInterface, EventSubscriber, UpdateEvent } from 'typeorm';
import Socket from '@src/socket';
import SocketEventsType from 'dd-common-blocks/dist/type/SocketEventsType';
import SubscriptionEntity from '@entity/subscription.entity';
import TeamEntity from '../entity/team.entity';
import { RemoveEvent } from 'typeorm/subscriber/event/RemoveEvent';
import { InsertEvent } from 'typeorm/subscriber/event/InsertEvent';
import TeamMemberEntity from '@entity/team-member.entity';
import TeamMemberStatus from 'dd-common-blocks/dist/type/TeamMemberStatus';
import MainDataSource from '@src/main-data-source';
import { NODE_ENV } from '@src/config';

@EventSubscriber()
export default class SubscriptionSubscriber implements EntitySubscriberInterface<SubscriptionEntity> {
	listenTo() {
		return SubscriptionEntity;
	}

	async _notifyUser(
		event: UpdateEvent<SubscriptionEntity> | RemoveEvent<SubscriptionEntity> | InsertEvent<SubscriptionEntity>,
		type: string
	): Promise<void> {
		const { entity } = event;

		if (!entity || !entity.id) return;

		const item = await MainDataSource.getRepository(SubscriptionEntity).findOne({ where: { id: entity.id } });
		if (!item) return;

		const teams = await MainDataSource.getRepository(TeamEntity)
			.createQueryBuilder('t')
			.leftJoinAndSelect('t.members', 'members')
			.leftJoinAndSelect('t.subscriptions', 'subscriptions')
			.where('subscriptions.id = :subId', { subId: entity.id })
			.getMany();

		const userIds: number[] = [item.userId];

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
						message: `User subscription ${type}.`,
					});
					return id;
				})
			);
	}

	async afterInsert(event: InsertEvent<SubscriptionEntity>): Promise<void> {
		return this._notifyUser(event, 'inserted');
	}

	async afterUpdate(event: UpdateEvent<SubscriptionEntity>): Promise<void> {
		return this._notifyUser(event, 'updated');
	}

	async afterRemove(event: RemoveEvent<SubscriptionEntity>): Promise<void> {
		return this._notifyUser(event, 'removed');
	}
}
