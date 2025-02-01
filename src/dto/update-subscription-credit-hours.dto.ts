import HoursType from 'dd-common-blocks/dist/type/HoursType';

export default class UpdateSubscriptionCreditHoursDto {
	id?: number;
	notRecurring?: boolean;
	recurringForever?: boolean;
	rollover?: boolean;
	recurringMonth?: number;
	used?: number;
	given?: number;
	userId?: number;
	monthlyAmount?: number;
	subscriptionId?: number;
	type: HoursType;
}
