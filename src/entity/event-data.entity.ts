import BaseEntity from '@entity/base.entity';
import { Column, Entity, JoinColumn, OneToOne } from "typeorm";
import SpaceEntity from '@entity/space.entity';
import DateWithTzTransformer from '@utils/transformer/date-with-tz';

@Entity({ name: 'EventData', schema: 'space' })
export default class EventDataEntity extends BaseEntity {
	@Column({ type: 'time' })
	accessHoursFrom: string;

	@Column({ type: 'time' })
	accessHoursTo: string;

	@OneToOne(() => SpaceEntity)
	@JoinColumn({ name: 'spaceId' })
	space: SpaceEntity;

	@Column({ type: 'timestamptz', transformer: new DateWithTzTransformer() })
	date: Date;

	@Column()
	spaceId: number;
}
