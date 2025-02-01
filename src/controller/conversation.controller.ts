import { Authorized, Body, CurrentUser, JsonController, Param, Post, Get } from "routing-controllers";
import { Inject, Service } from "typedi";
import ConversationService from "@services/conversation.service";
import UserEntity from '@entity/user.entity';
import { SuccessResponse } from '@utils/response/success.response';
import { OpenAPI } from "routing-controllers-openapi";
import SendMessageToConversationDto from "@src/dto/send-message-to-conversation.dto";
import { FeatureFlag } from '@src/utils/feature-flag';
import { Features } from '@src/utils/features';
import { ForbiddenResponse } from "@src/utils/response/forbidden.response";
import BrandRoleType from "dd-common-blocks/dist/type/BrandRoleType";

@Service()
@JsonController('/conversation')
export class ConversationController {
    @Inject()
    conversationService: ConversationService;
    features: Features;

    constructor() {
        this.features = new Features();
    }

    @Authorized()
    @Post('')
    @OpenAPI({
        description: 'Create new conversation',
    })
    async connect(@Body() { invoiceId , conversationId }: { invoiceId: string , conversationId : string}) {
        await this.isFeatureEnabled();
        var data : any;
        if(invoiceId){
            data = await this.conversationService.connect(invoiceId);
            console.info('data served successfully for invoice id');
            return new SuccessResponse({ message: 'Ok', data });
        }
        if(conversationId){
            data = await this.conversationService.connect(conversationId);
            console.info('data served successfully for conversation id');
            return new SuccessResponse({ message: 'Ok', data });
        }
    }

    @Authorized()
    @Post('/:conversationSid/messages')
    @OpenAPI({
        description: 'Send message',
    })
    async sendMessage(@Param('conversationSid') conversationSid: string, @Body() body: SendMessageToConversationDto, @CurrentUser() user?: UserEntity) {
        await this.isFeatureEnabled();
        if(user?.role?.roleType == BrandRoleType.VENUE_ADMIN){
            const data = await this.conversationService.sendMessage(conversationSid, body.messageBody, body.venueId, user, body.reservedToUserId, true);
             return new SuccessResponse({ message: 'Ok', data });
        }
        const data = await this.conversationService.sendMessage(conversationSid, body.messageBody, body.venueId, user, body.reservedToUserId, false);
        return new SuccessResponse({ message: 'Ok', data });
    }

    private async isFeatureEnabled() {
        const isCustomerChatWithVenueEnabled = await this.features.isEnabled(FeatureFlag.customerChatWithVenue);
        if (!isCustomerChatWithVenueEnabled) throw new ForbiddenResponse({ message: 'This feature is not enabled' });
    }

    @Authorized()
    @Get('/:userId')
    @OpenAPI({
        description: 'Send message',
    })
    async getConversations(@Param('userId') userId: string) {
        const data = await this.conversationService.getConversations(userId);
        return new SuccessResponse({ message: 'Ok', data });        
    }
    
}