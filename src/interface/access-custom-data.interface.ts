import { Dayjs } from 'dayjs';
import type BaseInterface from './base.interface';
export default interface AccessCustomDataInterface extends BaseInterface {
    weekday: string;
    open: boolean;
    venueId?: number;
    accessHoursFrom: string | Dayjs | Date | undefined;
    accessHoursTo: string | Dayjs | Date | undefined;
}
