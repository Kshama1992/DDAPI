import { IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import SpaceStatus from 'dd-common-blocks/dist/type/SpaceStatus';
import ChargeType from 'dd-common-blocks/dist/type/ChargeType';
import ChargeVariant from 'dd-common-blocks/dist/type/ChargeVariant';
import PackageShow from 'dd-common-blocks/dist/type/PackageShow';
import EventDataEntity from '@entity/event-data.entity';

/**
 * TODO
 */
export default class CreateSpaceDto {
	/**
	 * Space name
	 * @type {string}
	 */
	@IsString()
	@IsNotEmpty()
	name: string;

	/**
	 * Multiply used credit hours x2 by user if @see notAllowCredit is false
	 * @type {boolean}
	 */
	@IsBoolean()
	@IsOptional()
	credits2x?: boolean;

	/**
	 * Divide used credit hours by 2 if @see notAllowCredit is false
	 * @type {boolean}
	 */
	@IsBoolean()
	@IsOptional()
	creditsHalf?: boolean;

	/**
	 * Not allow using credit hours
	 * @type {boolean}
	 */
	@IsBoolean()
	@IsOptional()
	notAllowCredit?: boolean;

	/**
	 * Minimum hours that can be booked.
	 * @description e.g. if user booked 1 hour and roundHours is 2 then will be booked for 2 hours
	 * @type {number}
	 */
	@IsNumber()
	@IsOptional()
	roundHours?: number;

	/**
	 * Custom additional time
	 * @description Time that will be billed from user after exceeding round hours (if set. if not - will be ignored)
	 * @type {number}
	 */
	@IsNumber()
	@IsOptional()
	customAdditionalTime?: number;

	/**
	 * Space venue ID
	 * @type {number}
	 */
	@IsInt()
	@IsNotEmpty()
	venueId: number;

	/**
	 * Space republish interval
	 * @type {number}
	 */
	@IsNumber()
	@IsOptional()
	quantityRepublish?: number;

	/**
	 * Custom Republish Interval hours
	 * @type {number}
	 */
	@IsNumber()
	@IsOptional()
	quantityRepublishCustom?: number;

	/**
	 * 24/7 space access
	 * @type {boolean}
	 */
	@IsBoolean()
	@IsOptional()
	access247?: boolean;
	//
	// /**
	//  * Space open from time
	//  * @type {Date}
	//  */
	// @IsString()
	// @IsOptional()
	// accessHoursFrom?: string;
	//
	// /**
	//  * Space close time
	//  * @type {Date}
	//  */
	// @IsString()
	// @IsOptional()
	// accessHoursTo?: string;
	//
	// /**
	//  * Space access custom time
	//  * @type {SpaceAccessCustomDataEntity[]}
	//  */
	// accessCustomData: SpaceAccessCustomDataEntity[];

	/**
	 * Space price
	 * @type {number}
	 */
	@IsNumber()
	@IsOptional()
	price?: number;

	/**
	 * Space tax
	 * @type {number}
	 */
	@IsNumber()
	@IsOptional()
	tax?: number;

	/**
	 * Space quantity
	 * @todo check if we use it
	 * @type {number}
	 */
	@IsNumber()
	@IsOptional()
	quantity?: number;

	/**
	 * Hide space quantity
	 * @type {boolean}
	 */
	@IsBoolean()
	@IsOptional()
	hideQuantity?: boolean;

	/**
	 * Space created by user ID
	 * @type {number}
	 */
	@IsInt()
	@IsOptional()
	createdById?: number;

	/**
	 * Is space have security deposit
	 * @type {boolean}
	 */
	@IsBoolean()
	@IsOptional()
	securityDeposit?: boolean;

	@IsBoolean()
	@IsOptional()
	instantlyBookable?: boolean;

	/**
	 * Space security deposit
	 * @type {number}
	 */
	@IsInt()
	@IsOptional()
	securityDepositPrice?: number;

	/**
	 * Space status
	 * @type {SpaceStatus}
	 */
	@IsEnum(SpaceStatus)
	@IsOptional()
	status?: SpaceStatus;

	/**
	 * Space quantity is unlimited
	 * @type {boolean}
	 */
	@IsBoolean()
	@IsOptional()
	quantityUnlimited?: boolean;

	/**
	 * Space capacity
	 * @todo check this in service
	 * @type {number}
	 */
	@IsNumber()
	@IsOptional()
	capacity?: number;
	//
	// /**
	//  * Space access custom
	//  * @type {boolean}
	//  */
	// @IsBoolean()
	// @IsOptional()
	// accessCustom?: boolean;

	/**
	 * Space description
	 * @type {string}
	 */
	@IsString()
	@IsNotEmpty()
	description: string;

	/**
	 * Space type ID @see [SpaceTypeEntity]{@link SpaceTypeEntity}
	 * @type {number}
	 */
	@IsInt()
	@IsNotEmpty()
	spaceTypeId: number;

	/**
	 * Space charge type (one time, hourly, etc)
	 * @type {ChargeType}
	 */
	@IsEnum(ChargeType)
	@IsNotEmpty()
	chargeType: ChargeType;

	/**
	 * Space charge variant.
	 * @description Mostly for drop-in.
	 * 1. Charge as user goes (by timer)
	 * 2. Charge every minimum booking hours (add time from roundHours continuously)
	 * 3. Charge every custom additional time (add time from customAdditionalTime continuously after first roundHours)
	 * @type {ChargeVariant}
	 */
	@IsEnum(ChargeVariant)
	@IsOptional()
	chargeVariant?: ChargeVariant;

	/**
	 * Space package type
	 * @type {PackageShow}
	 */
	@IsEnum(PackageShow)
	@IsOptional()
	packageShow: PackageShow;

	/**
	 * Space bill cycle start date
	 * @type {number}
	 */
	@IsInt()
	@IsOptional()
	billCycleStart: number;

	/**
	 * Not in db. Attachments array. base64 images
	 * @type {string[]}
	 */
	@IsArray()
	@IsString({ each: true })
	uploadAttachments?: string[];

	/**
	 * Not in db. Venue id array.
	 * @type {number[]}
	 */
	@IsArray()
	@IsOptional()
	@IsInt({ each: true })
	venueIds?: number[];

	/**
	 * Getting started instructions
	 * @type {string}
	 */
	@IsString()
	@IsOptional()
	gettingStarted?: string;

	/**
	 * Event data relation
	 * @type {EventDataEntity}
	 */
	eventData: EventDataEntity;
}
