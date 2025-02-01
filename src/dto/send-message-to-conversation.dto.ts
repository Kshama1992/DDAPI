import { IsNotEmpty, IsNumber, IsString, MaxLength } from "class-validator";
import { JSONSchema } from "class-validator-jsonschema";

@JSONSchema({
    description: 'Send Message To Conversation DTO'
})
export default class SendMessageToConversationDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    @JSONSchema({
        description: 'Message Body',
        example: 'Test message',
    })
    messageBody: string;

    @IsNumber()
    @IsNotEmpty()
    @JSONSchema({
        description: 'Venue id',
        example: 12,
    })
    venueId: number;

    @IsNumber()    
    @JSONSchema({
        description: 'reserved To UserId',
        example: 0,
    })
    reservedToUserId: number;
}
