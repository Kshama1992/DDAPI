import { JSONSchema } from "class-validator-jsonschema";
import ConversationEntity from "@entity/conversation.entity";
import { ConversationMessage } from "@utils/helpers/twilio-conversations.helper";

@JSONSchema({
    description: 'Conversation response',
})
export default class ConversationResp {
    conversation: ConversationEntity;
    messages: ConversationMessage[];
    constructor(props: { conversation: ConversationEntity, messages: ConversationMessage[] }) {
        this.conversation = props.conversation;
        this.messages = props.messages;
    }
}