import { Dayjs } from 'dayjs';
import type BaseInterface from './base.interface';
export default interface EventDataInterface extends BaseInterface {
    accessHoursFrom: string | Dayjs | Date | undefined;
    accessHoursTo: string | Dayjs | Date | undefined;
    date: Date;
    spaceId: number;
}
