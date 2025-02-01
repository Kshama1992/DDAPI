import CreateInvoiceItemDto from './create-invoice-item.dto';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Validate } from 'class-validator';
import IsNumberOrString from '@utils/validator/number-or-string.validator';
import { JSONSchema } from 'class-validator-jsonschema';

@JSONSchema({
	description: 'Create invoice (book space) DTO',
})
export default class CreateInvoiceDto {
	/**
	 * Space ID
	 */
	@IsOptional()
	@Validate(IsNumberOrString)
	@JSONSchema({
		description: 'Package (Space) ID',
		example: 400,
	})
	spaceId?: number | string;

	/**
	 * User ID
	 */
	@IsOptional()
	@Validate(IsNumberOrString)
	@JSONSchema({
		description: 'User ID',
		example: 355,
	})
	userId?: number | string;

	/**
	 * Booking start date with time
	 */
	@IsString()
	@IsNotEmpty()
	@JSONSchema({
		description: 'Booking start date with time',
		example: '2022-08-24T23:59:59+03:00',
	})
	startDate: string;

	@IsString()
	@IsOptional()
	createdAt?: string;

	/**
	 * Booking end date with time
	 */
	@IsString()
	@IsNotEmpty()
	@JSONSchema({
		description: 'Booking end date with time',
		example: '2023-08-24T23:59:59+03:00',
	})
	endDate: string;

	/**
	 * User time zone name (e.g. America/New_York)
	 */
	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'User time zone name',
		example: 'America/New_York',
	})
	userTz?: string;

	/**
	 * Invoice created by ID
	 */
	@IsOptional()
	@Validate(IsNumberOrString)
	@JSONSchema({
		description: 'Invoice created by ID',
		example: 355,
	})
	createdById?: string | number;

	/**
	 * Use user credit hours
	 */
	@IsBoolean()
	@IsOptional()
	@JSONSchema({
		description: 'Use user credit hours',
		example: false,
		default: false,
	})
	useCredits?: boolean;

	/**
	 * Take payment from user
	 */
	@IsBoolean()
	@IsOptional()
	@JSONSchema({
		description: 'Take payment from user',
		example: true,
		default: true,
	})
	takePayment?: boolean;

	/**
	 * Invoice items array
	 */
	items?: CreateInvoiceItemDto[];

	/**
	 * @name Team name
	 * @description only for subscription creation. when admin creates team subscription for lead
	 */
	@IsString()
	@IsOptional()
	@JSONSchema({
		description: 'Team name. Only for subscription creation. when admin creates team subscription for lead',
		example: 'My awesome team',
	})
	teamName?: string;

	/**
	 * @name Team ID
	 * @description when user book space he can choose team
	 */
	@IsOptional()
	@Validate(IsNumberOrString)
	@JSONSchema({
		description: 'Team ID. when user book space he can choose team',
		example: 23,
	})
	teamId?: string | number;

	/**
	 * @name Subscription ID
	 * @description when user book space he can choose subscription
	 */
	@IsOptional()
	@Validate(IsNumberOrString)
	@JSONSchema({
		description: 'Subscription ID. when user book space he can choose subscription',
		example: 34,
	})
	subscriptionId?: string | number;

	/**
	 * @name Is web hook
	 * @description when request is from payment provider web hook	 */
	@IsBoolean()
	@IsOptional()
	@JSONSchema({
		description: 'Is web hook. when request is from payment provider web hook',
		example: false,
		default: false,
	})
	isWebhook?: boolean;
}
