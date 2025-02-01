import BaseEntity from '@entity/base.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import VenueEntity from '@entity/venue.entity';
import Weekdays from 'dd-common-blocks/dist/type/WeekdaysType';

@Entity({ name: 'AccessCustomData', schema: 'location' })
export default class AccessCustomDataEntity extends BaseEntity {
	@Column({ default: true })
	open: boolean;

	@Column({ type: 'time' })
	accessHoursFrom: string;

	@Column({ type: 'time' })
	accessHoursTo: string;

	@ManyToOne(() => VenueEntity, (venue) => venue.accessCustomData)
	@JoinColumn({ name: 'venueId' })
	venue: VenueEntity;

	@Column({
		type: 'enum',
		enum: Weekdays,
	})
	weekday: Weekdays;

	@Index()
	@Column()
	venueId: number;
}
