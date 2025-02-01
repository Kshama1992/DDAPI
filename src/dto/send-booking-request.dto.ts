import { IsNotEmpty, IsNumber, IsOptional } from "class-validator";
import { JSONSchema } from "class-validator-jsonschema";

@JSONSchema({
    description: 'Send booking request'
})
export default class SendBookingRequestDto {

    @IsNumber()
    @IsNotEmpty()
    @JSONSchema({
        description: 'venueId',
        example: 'venueId',
    })
    venueId: number;

    @IsNumber()
    @IsOptional()
    @JSONSchema({
        description: 'spaceId',
        example: 'spaceId',
    })
    spaceId: number;

}
