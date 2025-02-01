import { JsonController, Body, HeaderParam, Post, Req, UseBefore, Param } from 'routing-controllers';
import { OpenAPI } from '@utils/openapi';
import { Inject, Service } from 'typedi';
import { SuccessResponse } from '@utils/response/success.response';
import { NODE_ENV, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, TWILIO_AUTH_TOKEN, TWILIO_WEBHOOK_URL } from '@src/config';
import { ForbiddenResponse } from '@utils/response/forbidden.response';
import WebhookService from '@services/webhook.service';
import InstantlyBookableConversationService from '@src/services/instantlyBookableConversation.service';
import ConversationService from '@services/conversation.service';
import { webhookLoggerHelper } from '@helpers/logger.helper';
import { raw, Request } from 'express';
import { validateRequest } from 'twilio';
import bodyParser from 'body-parser';
import { ErrorResponse } from '@utils/response/error.response';
import { getStripeWebhookKeys } from '@src/utils/helpers/webhook.helper';
import { FeatureFlag } from '@src/utils/feature-flag';
import { Features } from '@src/utils/features';

@JsonController('/webhook/')
@Service()
export class WebhookController {
    @Inject()
    service: WebhookService;
    @Inject()
    conversationService: ConversationService;
	@Inject()
    instantlyBookableConversationService: InstantlyBookableConversationService;
	features: Features;

	stripe;
	stripeEndpointSecret;
	constructor() {
		this.stripeEndpointSecret = STRIPE_WEBHOOK_SECRET;
		this.stripe = require('stripe')(STRIPE_SECRET_KEY);
		this.features = new Features();
	}

	@Post('stripe')
	@OpenAPI({
		description: 'Stripe webhooks',
	})
	@UseBefore(raw({ type: 'application/json' }))
	async webhookStripe(@Body() body: any, @HeaderParam('stripe-signature') stripeSignature: string, @Req() request: Request) {
		let event = body;
		if (NODE_ENV == 'test' || NODE_ENV == 'qa' || NODE_ENV == 'development') {
		}
		const stripekeys = await getStripeWebhookKeys(null);
		this.stripeEndpointSecret = stripekeys.stripeWebhookSecret;
		this.stripe = require('stripe')(stripekeys.stripePrivateKey);
		if (this.stripeEndpointSecret) {
			// Get the signature sent by Stripe
			try {
				event = this.stripe.webhooks.constructEvent(request.body, stripeSignature, this.stripeEndpointSecret);

				if (Buffer.isBuffer(event)) event = JSON.parse(event.toString());
				webhookLoggerHelper.info(event.type);
				await this.service.stripeHooks(event);
			} catch (e) {
				webhookLoggerHelper.error(`⚠️  Webhook signature verification failed.`, (e as Error).message);
				return new ForbiddenResponse({ message: (e as Error).message });
			}
		}

        return new SuccessResponse({ data: {} });
    }

    @Post('twilio')
    @OpenAPI({
        description: 'Twilio webhooks',
    })
    @UseBefore(bodyParser.urlencoded({extended: true}))
    async twilioStripe(@Body() body: any, @HeaderParam('x-twilio-signature') twilioSignature: string) {
        const isValidRequest = validateRequest(TWILIO_AUTH_TOKEN, twilioSignature, TWILIO_WEBHOOK_URL, body);
        if (!isValidRequest) {
            webhookLoggerHelper.error(`⚠️  Twilio signature verification failed.`);
            return new ForbiddenResponse();
        }
        try {
			if(await this.features.isEnabled(FeatureFlag.instantlyBookableFeature)) await this.instantlyBookableConversationService.handleTwilioWebhookRequest(body)			
			await this.conversationService.handleTwilioWebhookRequest(body);
			
        } catch (e) {
            webhookLoggerHelper.error((e as Error).message);
            return new ErrorResponse({ message: (e as Error).message || 'Error occurred' });
        }
        return new SuccessResponse({ data: {} });
    }

	@Post('stripe/:id')
	@OpenAPI({
		description: 'Stripe webhooks',
	})
	@UseBefore(raw({ type: 'application/json' }))
	async webhookStripeForOtherAccounts(@Body() body: any,@Param('id') brandId: number, @HeaderParam('stripe-signature') stripeSignature: string, @Req() request: Request) {
		let event = body;		
		const stripekeys = await getStripeWebhookKeys(brandId);
		this.stripeEndpointSecret = stripekeys.stripeWebhookSecret;
		this.stripe = require('stripe')(stripekeys.stripePrivateKey);
		
		
		if (this.stripeEndpointSecret) {
			// Get the signature sent by Stripe
			try {
				event = this.stripe.webhooks.constructEvent(request.body, stripeSignature, this.stripeEndpointSecret);

				if (Buffer.isBuffer(event)) event = JSON.parse(event.toString());
				webhookLoggerHelper.info(event.type);
				await this.service.stripeHooks(event);
			} catch (e) {
				webhookLoggerHelper.error(`⚠️  Webhook signature verification failed.`, (e as Error).message);
				return new ForbiddenResponse({ message: (e as Error).message });
			}
		}

        return new SuccessResponse({ data: {} });
    }
}
