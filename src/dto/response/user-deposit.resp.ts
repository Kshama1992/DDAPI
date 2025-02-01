import { JSONSchema } from 'class-validator-jsonschema';
import { IsNotEmpty, IsNumber } from 'class-validator';

@JSONSchema({
	description: 'User deposit response',
	example: {
		deposit: 9,
	},
})
export default class UserDepositResponse {
	@IsNumber()
	@IsNotEmpty()
	@JSONSchema({
		description: 'User deposit amount',
		example: 0,
	})
	deposit: number;

	constructor(props: { deposit: number }) {
		this.deposit = props.deposit;
	}
}
