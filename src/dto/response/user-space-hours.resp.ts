import { JSONSchema } from 'class-validator-jsonschema';
import { IsNotEmpty, IsNumber } from 'class-validator';

@JSONSchema({
	description: 'User space hours response',
	example: {
		spaceId: 123,
		creditBalance: 100,
		creditHours: 30,
		billable: 12,
	},
})
export default class UserSpaceHoursResponse {
	@IsNumber()
	@IsNotEmpty()
	@JSONSchema({
		description: 'Space ID',
		example: 123,
	})
	spaceId: number;

	@IsNumber()
	@IsNotEmpty()
	@JSONSchema({
		description: 'User credit hours balance',
		example: 100,
	})
	creditBalance: number;

	@IsNumber()
	@IsNotEmpty()
	@JSONSchema({
		description: 'Available credits hours',
		example: 30,
	})
	creditHours: number;

	@IsNumber()
	@IsNotEmpty()
	@JSONSchema({
		description: 'Billable hours',
		example: 12,
	})
	billable: number;

	constructor(props: { spaceId: number; billable: number; creditHours: number; creditBalance: number }) {
		this.billable = props.billable;
		this.spaceId = props.spaceId;
		this.creditHours = props.creditHours;
		this.creditBalance = props.creditBalance;
	}
}
