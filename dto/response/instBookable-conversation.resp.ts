import { JSONSchema } from "class-validator-jsonschema";
import { ConversationMessage } from "@utils/helpers/twilio-conversations.helper";
import InstantlyBookableConversationEntity from "@src/entity/InstantlyBookable-conversation.entity";

@JSONSchema({
    description: 'Instantly bookable Conversation response',
})
export default class InstBookableConversationResp {
    conversation: InstantlyBookableConversationEntity;
    messages: ConversationMessage[];
    constructor(props: { conversation: InstantlyBookableConversationEntity, messages: ConversationMessage[] }) {
        this.conversation = props.conversation;
        this.messages = props.messages;
    }
}