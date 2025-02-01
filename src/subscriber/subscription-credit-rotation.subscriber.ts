import { EntitySubscriberInterface, EventSubscriber, UpdateEvent } from 'typeorm';
import Socket from '@src/socket';
import SocketEventsType from 'dd-common-blocks/dist/type/SocketEventsType';
import SubscriptionCreditsRotationEntity from '@entity/subscription-credits-rotation.entity';
import TeamEntity from '../entity/team.entity';
import { RemoveEvent } from 'typeorm/subscriber/event/RemoveEvent';
import { InsertEvent } from 'typeorm/subscriber/event/InsertEvent';
import TeamMemberEntity from '@entity/team-member.entity';
import TeamMemberStatus from 'dd-common-blocks/dist/type/TeamMemberStatus';
import MainDataSource from '@src/main-data-source';

@EventSubscriber()
export default class SubscriptionCreditRotationSubscriber implements EntitySubscriberInterface<SubscriptionCreditsRotationEntity> {
	listenTo() {
		return SubscriptionCreditsRotationEntity;
	}

	async _notifyUser(
		event:
			| UpdateEvent<SubscriptionCreditsRotationEntity>
			| RemoveEvent<SubscriptionCreditsRotationEntity>
			| InsertEvent<SubscriptionCreditsRotationEntity>
	): Promise<void> {
		const { entity } = event;

		if (!entity || !entity.subscriptionId) return;

		const { subscriptionId } = entity;

		const teams = await MainDataSource.getRepository(TeamEntity)
			.createQueryBuilder('t')
			.leftJoinAndSelect('t.members', 'members')
			.leftJoinAndSelect('t.subscriptions', 'subscriptions')
			.where('subscriptions.id = :subId', { subId: subscriptionId })
			.getMany();

		const userIds: number[] = [];

		teams.forEach((t) => {
			userIds.push(t.teamLeadId);
			if (t.members && t.members.length > 0) {
				t.members
					.filter((m) => m.memberId && m.status !== TeamMemberStatus.MEMBER_REMOVED)
					.forEach((m: TeamMemberEntity) => userIds.push(m.memberId!));
			}
		});

		await Promise.all(
			userIds.map((id) => {
				Socket.connection().sendEventToUser(String(id), SocketEventsType.USER_CREDIT_HOURS_UPDATED, {
					subscriptionId,
					message: 'User credit hours updated.',
				});
				return id;
			})
		);
	}

	async afterUpdate(event: UpdateEvent<SubscriptionCreditsRotationEntity>): Promise<void> {
		const { entity, databaseEntity } = event;
		if (!entity || JSON.stringify(entity) === JSON.stringify(databaseEntity)) return;
		return this._notifyUser(event);
	}

	async afterRemove(event: RemoveEvent<SubscriptionCreditsRotationEntity>): Promise<void> {
		return this._notifyUser(event);
	}

	async afterInsert(event: InsertEvent<SubscriptionCreditsRotationEntity>): Promise<void> {
		return this._notifyUser(event);
	}
}
