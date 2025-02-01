import { EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from 'typeorm';
import InvoiceEntity from '@entity/invoice.entity';
import dayjs from 'dayjs';
import dayjsutc from 'dayjs/plugin/utc';
import dayjsduration from 'dayjs/plugin/duration';
import dayjstimezone from 'dayjs/plugin/timezone';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { RemoveEvent } from 'typeorm/subscriber/event/RemoveEvent';
import MainDataSource from '@src/main-data-source';
import TeamEntity from '@entity/team.entity';
import TeamMemberStatus from 'dd-common-blocks/dist/type/TeamMemberStatus';
import TeamMemberEntity from '@entity/team-member.entity';
import { NODE_ENV } from '@src/config';
import Socket from '@src/socket';
import SocketEventsType from 'dd-common-blocks/dist/type/SocketEventsType';

dayjs.extend(dayjsutc);
dayjs.extend(dayjstimezone);
dayjs.extend(dayjsduration);
dayjs.extend(isSameOrBefore);

@EventSubscriber()
export default class InvoiceSubscriber implements EntitySubscriberInterface<InvoiceEntity> {
	listenTo() {
		return InvoiceEntity;
	}

	async _notifyUser(event: UpdateEvent<InvoiceEntity> | RemoveEvent<InvoiceEntity> | InsertEvent<InvoiceEntity>, type: string): Promise<void> {
		const { entity } = event;

		if (!entity || !entity.id || !entity.subscriptionId || !entity.paid) return;

		const teams = await MainDataSource.getRepository(TeamEntity)
			.createQueryBuilder('t')
			.leftJoinAndSelect('t.members', 'members')
			.leftJoinAndSelect('t.subscriptions', 'subscriptions')
			.where('subscriptions.id = :subId', { subId: entity.subscriptionId })
			.getMany();

		const userIds: number[] = [entity.userId];

		teams.forEach((t) => {
			if (t.members && t.members.length > 0) {
				t.members
					.filter((m) => m.memberId && m.status !== TeamMemberStatus.MEMBER_REMOVED)
					.forEach((m: TeamMemberEntity) => userIds.push(m.memberId!));
			}
		});

		if (NODE_ENV !== 'test')
			await Promise.all(
				userIds.map((id) => {
					Socket.connection().sendEventToUser(String(id), SocketEventsType.USER_INVOICE_UPDATED, {
						subscriptionId: entity.subscriptionId,
						message: `User invoice ${type}.`,
					});
					return id;
				})
			);
	}

	async afterUpdate(event: UpdateEvent<InvoiceEntity>) {
		return this._notifyUser(event, 'updated');
	}

	async afterInsert(event: InsertEvent<InvoiceEntity>) {
		return this._notifyUser(event, 'updated');
	}
}
