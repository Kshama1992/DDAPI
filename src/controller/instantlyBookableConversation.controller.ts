import { Authorized, Body, CurrentUser, Get, JsonController, Param, Post, QueryParams } from "routing-controllers";
import { Inject, Service } from "typedi";
import UserEntity from '@entity/user.entity';
import { SuccessResponse } from '@utils/response/success.response';
import { OpenAPI } from "routing-controllers-openapi";
import { FeatureFlag } from '@src/utils/feature-flag';
import { Features } from '@src/utils/features';
import { ForbiddenResponse } from "@src/utils/response/forbidden.response";
import SendBookingRequestDto from "@src/dto/send-booking-request.dto";
import InstantlyBookableConversationService from "@src/services/instantlyBookableConversation.service";
import winstonLogger from "@src/utils/helpers/winston-logger";


@Service()
@JsonController('/instantlyBookableConversation')
export class InstantlyBookableConversationController {
    @Inject()
    instantlyBookableConversationService: InstantlyBookableConversationService;
    features: Features;

    constructor() {
        this.features = new Features();
    }

    @Authorized()
    @Post('')
    @OpenAPI({
        description: 'Create new instantlyBookableconversation',
    })
    async connect(@Body() {conversationId, userId, venueId }: {conversationId : string, userId:number, venueId: number}) {
		await this.isFeatureEnabled();
		if (conversationId) {
            winstonLogger.info(`starting connection for conversation id ${conversationId}, user id ${userId} and venue id ${venueId}`);
			const data = await this.instantlyBookableConversationService.connect(conversationId,userId, venueId);
            winstonLogger.info(`data served successfully for conversation id ${conversationId}`);
			return new SuccessResponse({ message: 'Ok', data });
		}
	}

    @Authorized()
    @Post('/:conversationSid/sendBookingRequest')
    @OpenAPI({
        description: 'send Booking Request',
    })
    async sendBookingRequest(@Param('conversationSid') conversationSid: string, @Body() body: SendBookingRequestDto, @CurrentUser() user?: UserEntity) {
        await this.isFeatureEnabled();
        winstonLogger.info(`starting to send booking request for conversation id ${conversationSid}`);
        const data = await this.instantlyBookableConversationService.sendBookingRequest(conversationSid, body.venueId, user);
        winstonLogger.info(`data served successfully for sending booking request: ${data}`);
        return new SuccessResponse({ message: 'Ok', data });
    }

    @Authorized()
    @Get('/getBookingRequestStatus')
    @OpenAPI({
        description: 'get Booking Request status',
    })
    async getBookingRequestStatus(@QueryParams() query: any) {
        await this.isFeatureEnabled();
        winstonLogger.info(`starting to get booking request status query: ${query}`);
        const data = await this.instantlyBookableConversationService.getBookingRequestStatus(query);
        winstonLogger.info(`data served successfully for booking request status: ${data}`);
        return new SuccessResponse({ message: 'Ok', data });
    }


    private async isFeatureEnabled() {
        const isinstantlyBookableFeatureEnabled = await this.features.isEnabled(FeatureFlag.instantlyBookableFeature);
        if (!isinstantlyBookableFeatureEnabled) throw new ForbiddenResponse({ message: 'This feature is not enabled' });
    }
    
}