import ConversationService from "@services/conversation.service";
import ConversationEntity from "@entity/conversation.entity";
import UserEntity from "@entity/user.entity";
import { Repository } from "typeorm";
import MainDataSource from "@src/main-data-source";
import { faker } from "@faker-js/faker";
import UserStatus from "dd-common-blocks/dist/type/UserStatus";
import { TestRoleMember } from "@utils/tests/base-data";
import * as twilioConversationsHelper from '@helpers/twilio-conversations.helper';
import loggerHelper from "@utils/helpers/logger.helper";
import VenueEntity from "@entity/venue.entity";
import ConversationParticipantEntity from "@entity/conversation-participant.entity";

let conversationService: ConversationService;

const user: UserEntity = {
    id: Number(faker.random.numeric(2)),
    firstname: faker.name.firstName(),
    lastname: faker.name.lastName(),
    username: faker.internet.userName(),
    subscriptions: [],
    isAdmin: false,
    securityDepositToRevenue: Number(faker.random.numeric(2)),
    email: faker.internet.email(),
    emailVerified: true,
    stripeCustomerId: '',
    securityDeposit: Number(faker.random.numeric(2)),
    about: '',
    phone: 0,
    brandId: Number(faker.random.numeric(2)),
    roleId: Number(faker.random.numeric(2)),
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    role: TestRoleMember,
    _canDelete(user: UserEntity | undefined): boolean {
        return true;
    },
    _canEdit(user: UserEntity | undefined): boolean {
        return true;
    },
    isSuperAdmin(): boolean {
        return false;
    },
};

const invoiceId = Number(faker.random.numeric(2));

const conversationItem: ConversationEntity = {
    id: Number(faker.random.numeric(2)),
    friendlyName: `conversation-invoice-${invoiceId}`,
    conversationSid: faker.datatype.uuid(),
    webhookSid: faker.datatype.uuid(),
    proxyNumber: Number(faker.phone.number('516#######')),
    proxyNumberSid: faker.datatype.uuid(),
    isLocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    participants: []
};

const webhookRequest = {
    EventType: 'invalid event',
    ConversationSid: faker.datatype.uuid(),
    ParticipantSid: faker.datatype.uuid(),
    Body: 'test message'
};

const existingMessages = [{
    messageSid: faker.datatype.uuid(),
    participantSid: faker.datatype.uuid(),
    displayName: faker.name.fullName(),
    message: faker.lorem.words(5),
    dateCreated: new Date()
}];

describe('SERVICE: Conversation Service', () => {
    let conversationRepository: Repository<ConversationEntity>;
    let venueRepository: Repository<VenueEntity>;

    beforeAll(() => {
        conversationService = new ConversationService();
    });

    beforeEach(() => {
        jest.resetAllMocks();
        conversationRepository = MainDataSource.getRepository(ConversationEntity);
        venueRepository = MainDataSource.getRepository(VenueEntity);
    });

    describe('method "connect"', () => {
        it('should return existing conversation', async () => {
            const existingConversationSpy = jest.spyOn(conversationRepository as any, 'findOne').mockReturnValue(conversationItem);
            const createConversationSpy = jest.spyOn(conversationRepository as any, 'create').mockReturnValue(null);
            const saveConversationSpy = jest.spyOn(conversationRepository as any, 'save').mockReturnValue(null);
            const createTwilioConversationSpy = jest.spyOn(twilioConversationsHelper, 'createTwilioConversation').mockReturnValue(Promise.resolve({ conversationSid: conversationItem.conversationSid }));
            const createTwilioConversationScopedWebhookSpy = jest.spyOn(twilioConversationsHelper, 'createTwilioConversationScopedWebhook').mockReturnValue(Promise.resolve({ webhookSid: conversationItem.webhookSid }));
            const getMessagesFromConversationSpy = jest.spyOn(twilioConversationsHelper, 'getMessagesFromConversation').mockReturnValue(Promise.resolve(existingMessages));
            const loggerHelperSpy = jest.spyOn(loggerHelper, 'error').mockImplementationOnce(jest.fn());

            const conversation = await conversationService.connect(invoiceId);

            expect(existingConversationSpy).toHaveBeenCalledTimes(1);
            expect(getMessagesFromConversationSpy).toHaveBeenCalledTimes(1);
            expect(saveConversationSpy).not.toHaveBeenCalled();
            expect(createConversationSpy).not.toHaveBeenCalled();
            expect(createTwilioConversationSpy).not.toHaveBeenCalled();
            expect(createTwilioConversationScopedWebhookSpy).not.toHaveBeenCalled();
            expect(loggerHelperSpy).not.toHaveBeenCalled();
            expect(conversation).toStrictEqual({ conversation: conversationItem, messages: existingMessages });
        });

        it('should create new conversation when there is not existing conversation', async () => {
            const existingConversationSpy = jest.spyOn(conversationRepository as any, 'findOne').mockReturnValue(null);
            const createConversationSpy = jest.spyOn(conversationRepository as any, 'create').mockReturnValue(null);
            const saveConversationSpy = jest.spyOn(conversationRepository as any, 'save').mockReturnValue(conversationItem);
            const createTwilioConversationSpy = jest.spyOn(twilioConversationsHelper, 'createTwilioConversation').mockReturnValue(Promise.resolve({ conversationSid: conversationItem.conversationSid }));
            const createTwilioConversationScopedWebhookSpy = jest.spyOn(twilioConversationsHelper, 'createTwilioConversationScopedWebhook').mockReturnValue(Promise.resolve({ webhookSid: conversationItem.webhookSid }));
            const loggerHelperSpy = jest.spyOn(loggerHelper, 'error').mockImplementationOnce(jest.fn());

            const conversation = await conversationService.connect(invoiceId);

            expect(existingConversationSpy).toHaveBeenCalledTimes(1);
            expect(saveConversationSpy).toHaveBeenCalledTimes(1);
            expect(createConversationSpy).toHaveBeenCalledTimes(1);
            expect(createTwilioConversationSpy).toHaveBeenCalledTimes(1);
            expect(createTwilioConversationScopedWebhookSpy).toHaveBeenCalledTimes(1);
            expect(loggerHelperSpy).not.toHaveBeenCalled();
            expect(conversation).toStrictEqual({ conversation: conversationItem, messages: [] });
        });

        it('should throw exception if it fails to get or create conversation', async () => {
            const existingConversationSpy = jest.spyOn(conversationRepository as any, 'findOne').mockReturnValue(null);
            const createConversationSpy = jest.spyOn(conversationRepository as any, 'create').mockReturnValue(null);
            const saveConversationSpy = jest.spyOn(conversationRepository as any, 'save').mockImplementationOnce(async () => { throw new Error('some error') });
            const createTwilioConversationSpy = jest.spyOn(twilioConversationsHelper, 'createTwilioConversation').mockReturnValue(Promise.resolve({ conversationSid: conversationItem.conversationSid }));
            const createTwilioConversationScopedWebhookSpy = jest.spyOn(twilioConversationsHelper, 'createTwilioConversationScopedWebhook').mockReturnValue(Promise.resolve({ webhookSid: conversationItem.webhookSid }));
            const loggerHelperSpy = jest.spyOn(loggerHelper, 'error').mockImplementationOnce(jest.fn());

            try {
                await conversationService.connect(invoiceId);
            } catch (e: any) {
                expect(existingConversationSpy).toHaveBeenCalledTimes(1);
                expect(saveConversationSpy).toHaveBeenCalledTimes(1);
                expect(createConversationSpy).toHaveBeenCalledTimes(1);
                expect(createTwilioConversationSpy).toHaveBeenCalledTimes(1);
                expect(createTwilioConversationScopedWebhookSpy).toHaveBeenCalledTimes(1);
                expect(loggerHelperSpy).toHaveBeenCalledTimes(1);
                expect(e.message).toEqual('some error');
            }
        });
    });

    describe('method "sendMessage"', () => {
        it('should throw exception if it fails to get conversation', async () => {
            const existingConversationSpy = jest.spyOn(conversationRepository as any, 'findOne').mockReturnValue(null);
            const loggerHelperSpy = jest.spyOn(loggerHelper, 'error').mockImplementationOnce(jest.fn());

            try {
                await conversationService.sendMessage(faker.datatype.uuid(), 'test message', Number(faker.random.numeric(2)), user);
            } catch (e: any) {
                expect(existingConversationSpy).toHaveBeenCalledTimes(1);
                expect(loggerHelperSpy).toHaveBeenCalledTimes(1);
                expect(e.message).toEqual('Invalid conversationSid');
            }
        });

        it('should return messageSid after sending the message for exising conversation', async () => {
            const testMessageSid = faker.datatype.uuid();
            const chatParticipant = new ConversationParticipantEntity();
            const smsUserParticipant = new ConversationParticipantEntity();
            const smsVenueParticipant = new ConversationParticipantEntity();
            conversationItem.participants = [chatParticipant, smsUserParticipant, smsVenueParticipant];
            const existingConversationSpy = jest.spyOn(conversationRepository as any, 'findOne').mockReturnValue(conversationItem);
            const sendTwilioMessageSpy = jest.spyOn(twilioConversationsHelper, 'sendTwilioMessage').mockReturnValue(Promise.resolve({ messageSid: testMessageSid, messageBody: 'test message', dateCreated: new Date() }));
            const sendNotificationToUserSpy = jest.spyOn(conversationService as any, 'sendNotificationToUser').mockImplementationOnce(jest.fn());

            const { messageSid } = await conversationService.sendMessage(faker.datatype.uuid(), 'test message', Number(faker.random.numeric(2)), user);

            expect(messageSid).toEqual(testMessageSid);
            expect(existingConversationSpy).toHaveBeenCalledTimes(1);
            expect(sendTwilioMessageSpy).toHaveBeenCalledTimes(1);
            expect(sendNotificationToUserSpy).toHaveBeenCalledTimes(1);
        });

        it('should throw exception if proxyNumber is not set and venue is not found', async () => {
            conversationItem.proxyNumber = undefined;
            const existingConversationSpy = jest.spyOn(conversationRepository as any, 'findOne').mockReturnValue(conversationItem);
            const existingVenueSpy = jest.spyOn(venueRepository as any, 'findOne').mockReturnValue(null);
            const loggerHelperSpy = jest.spyOn(loggerHelper, 'error').mockImplementationOnce(jest.fn());

            try {
                await conversationService.sendMessage(faker.datatype.uuid(), 'test message', Number(faker.random.numeric(2)), user);
            } catch (e: any) {
                expect(existingConversationSpy).toHaveBeenCalledTimes(1);
                expect(existingVenueSpy).toHaveBeenCalledTimes(1);
                expect(loggerHelperSpy).toHaveBeenCalledTimes(1);
                expect(e.message).toEqual('Invalid venueId');
            }
        });

        it('should return messageSid after sending the message new conversation', async () => {
            const testMessageSid = faker.datatype.uuid();
            const testChatParticipantSid = faker.datatype.uuid();
            const testSMSParticipantSid = faker.datatype.uuid();
            conversationItem.proxyNumber = undefined;
            const existingConversationSpy = jest.spyOn(conversationRepository as any, 'findOne').mockReturnValue(conversationItem);
            const existingVenueSpy = jest.spyOn(venueRepository as any, 'findOne').mockReturnValue(Promise.resolve({ phone: Number(faker.phone.number('516#######')) }));
            const saveConversationSpy = jest.spyOn(conversationRepository as any, 'save').mockReturnValue(conversationItem);
            const sendTwilioMessageSpy = jest.spyOn(twilioConversationsHelper, 'sendTwilioMessage').mockReturnValue(Promise.resolve({ messageSid: testMessageSid, messageBody: 'test message', dateCreated: new Date() }));
            const addTwilioChatParticipantSpy = jest.spyOn(twilioConversationsHelper, 'addTwilioChatParticipant').mockReturnValue(Promise.resolve({ participantSid: testChatParticipantSid }));
            const addTwilioSMSParticipantSpy = jest.spyOn(twilioConversationsHelper, 'addTwilioSMSParticipant').mockReturnValue(Promise.resolve({ participantSid: testSMSParticipantSid }));
            const getTwilioPhoneNumbersSpy = jest.spyOn(twilioConversationsHelper, 'getTwilioPhoneNumbers').mockReturnValue(Promise.resolve([{ isoCountry: 'US', phoneNumber: faker.phone.number('+516#######'), region: 'NY' }]));
            const purchaseTwilioPhoneNumberSpy = jest.spyOn(twilioConversationsHelper, 'purchaseTwilioPhoneNumber').mockReturnValue(Promise.resolve({ twilioPhoneNumberSid: faker.datatype.uuid(), twilioPhoneNumber: faker.phone.number('+516#######') }));
            const removeTwilioConversationParticipantsSpy = jest.spyOn(twilioConversationsHelper, 'removeTwilioConversationParticipants').mockImplementationOnce(jest.fn());
            const sendNotificationToUserSpy = jest.spyOn(conversationService as any, 'sendNotificationToUser').mockImplementationOnce(jest.fn());

            const { messageSid } = await conversationService.sendMessage(faker.datatype.uuid(), 'test message', Number(faker.random.numeric(2)), user);

            expect(messageSid).toEqual(testMessageSid);
            expect(existingConversationSpy).toHaveBeenCalledTimes(1);
            expect(existingVenueSpy).toHaveBeenCalledTimes(1);
            expect(saveConversationSpy).toHaveBeenCalledTimes(2);
            expect(sendTwilioMessageSpy).toHaveBeenCalledTimes(1);
            expect(getTwilioPhoneNumbersSpy).toHaveBeenCalledTimes(1);
            expect(purchaseTwilioPhoneNumberSpy).toHaveBeenCalledTimes(1);
            expect(addTwilioChatParticipantSpy).toHaveBeenCalledTimes(1);
            expect(addTwilioSMSParticipantSpy).toHaveBeenCalledTimes(2);
            expect(removeTwilioConversationParticipantsSpy).toHaveBeenCalledTimes(1);
            expect(sendNotificationToUserSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('method "handleTwilioWebhookRequest"', () => {
        it('should throw exception if event type is invalid', async () => {
            const loggerHelperSpy = jest.spyOn(loggerHelper, 'error').mockImplementationOnce(jest.fn());
            try {
                await conversationService.handleTwilioWebhookRequest(webhookRequest);
            } catch (e: any) {
                expect(loggerHelperSpy).toHaveBeenCalledTimes(1);
                expect(e.message).toEqual(`Invalid event type: ${webhookRequest.EventType}`);
            }
        });

        it('should throw exception if it fails to get conversation', async () => {
            const existingConversationSpy = jest.spyOn(conversationRepository as any, 'findOne').mockReturnValue(null);
            const loggerHelperSpy = jest.spyOn(loggerHelper, 'error').mockImplementationOnce(jest.fn());
            webhookRequest.EventType = 'onMessageAdded';

            try {
                await conversationService.handleTwilioWebhookRequest(webhookRequest);
            } catch (e: any) {
                expect(existingConversationSpy).toHaveBeenCalledTimes(1);
                expect(loggerHelperSpy).toHaveBeenCalledTimes(1);
                expect(e.message).toEqual('Invalid conversationSid');
            }
        });

        it('should send notification to chat participant', async () => {
            const chatConversationParticipant = new ConversationParticipantEntity();
            chatConversationParticipant.displayName = 'Chat Participant';
            chatConversationParticipant.participantUserId = Number(faker.random.numeric(2));
            chatConversationParticipant.participantSid = faker.datatype.uuid();
            chatConversationParticipant.conversationId = conversationItem.id;
            const venueParticipant = new ConversationParticipantEntity();
            venueParticipant.displayName = 'Venue Manager';
            venueParticipant.participantUserId = Number(faker.random.numeric(2));
            venueParticipant.participantSid = webhookRequest.ParticipantSid;
            venueParticipant.conversationId = conversationItem.id;
            conversationItem.participants = [chatConversationParticipant, venueParticipant];
            const existingConversationSpy = jest.spyOn(conversationRepository as any, 'findOne').mockReturnValue(conversationItem);
            const sendNotificationToUserSpy = jest.spyOn(conversationService as any, 'sendNotificationToUser').mockImplementationOnce(jest.fn());
            const loggerHelperSpy = jest.spyOn(loggerHelper, 'error').mockImplementationOnce(jest.fn());
            webhookRequest.EventType = 'onMessageAdded';

            await conversationService.handleTwilioWebhookRequest(webhookRequest);

            expect(existingConversationSpy).toHaveBeenCalledTimes(1);
            expect(sendNotificationToUserSpy).toHaveBeenCalledTimes(1);
            expect(loggerHelperSpy).not.toHaveBeenCalled();
        });
    });
});