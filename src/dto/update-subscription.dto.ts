import UpdateSubscriptionCreditHoursDto from './update-subscription-credit-hours.dto';
import SubscriptionStatus from 'dd-common-blocks/dist/type/SubscriptionStatus';
import { IsEnum, IsOptional } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

@JSONSchema({
	description: 'Update subscription DTO',
})
export default class UpdateSubscriptionDto {
	@IsOptional()
	@IsEnum(SubscriptionStatus)
	@JSONSchema({
		description: 'Subscription status',
		example: 'active',
		enum: Object.values(SubscriptionStatus),
	})
	status?: SubscriptionStatus;
	creditHours?: UpdateSubscriptionCreditHoursDto[];
	spaceAmount?: number;
	updatedById?: number;
	billCycleDate?: number;
	endDate?: string;
	isOngoing?: boolean;
	takePayment?: boolean;
	brands?: any[];
	venues?: any[];
	venueTypes?: any[];
	spaceTypes?: any[];
	resetBillAnchorToNow?: boolean;
	id?: number;
}
