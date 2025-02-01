import { Repository } from "typeorm";
import MainDataSource from "@src/main-data-source";
import { faker } from "@faker-js/faker";
import * as twilioConversationsHelper from '@helpers/twilio-conversations.helper';
import loggerHelper from "@utils/helpers/logger.helper";
import InstantlyBookableConversationService from "../instantlyBookableConversation.service";
import InstantlyBookableConversationEntity from "@src/entity/InstantlyBookable-conversation.entity";
import SpaceEntity from "@src/entity/space.entity";
import InstantlyBookableParticipantEntity from "@src/entity/InstantlyBookable-participant.entity";
import { TestUserBrandMember, TestReservation, TestSubscription, TestSpaceMonthlySecond, TestSpaceMonthly, TestBrandSecond } from "@src/utils/tests/base-data";
import InvoiceEntity from "@src/entity/invoice.entity";
import { CreateQueryBuilderMock } from "@src/utils/tests/typeorm.mock";
import VenueEntity from "@src/entity/venue.entity";
import VenueStatus from "dd-common-blocks/dist/type/VenueStatus";
import * as SendSMSHelper from  "@src/utils/helpers/twilio";
import UserEntity from "@src/entity/user.entity";
import InvoiceStatusEntity from '@src/entity/invoice-status.entity';
import SecurityDepositStatusEntity from "@src/entity/securityDeposit-status.entity";

let instantlyBookableConversationService: InstantlyBookableConversationService;


const invoiceId = faker.random.numeric(4)+"-"+faker.random.numeric(4);
const userId = Number(faker.random.numeric(2));
const venueId = Number(faker.random.numeric(2));

// @ts-ignore
const paidInvoiceStatusList: InvoiceStatusEntity = {
	name: 'Paid',
	id: 6,
	_canCreate: function (user?: UserEntity | undefined): boolean {
		if (!user) return false;
		return user.isSuperAdmin();
	},
	_canEdit: function (user?: UserEntity | undefined): boolean {
		if (!user) return false;
		return user.isSuperAdmin();
	},
	createdAt: new Date(),
	updatedAt: new Date(),
};

// @ts-ignore
const venueItem: VenueEntity = {
    name: "test",
    countryCode: "",
    accessHoursFrom: new Date(),
    accessHoursTo: new Date(),
    description: "",
    coordinates: {
        type: "",
        coordinates: []
    },
   
    accessOpen: false,
    accessCustom: false,
    showOnMap: false,
    venueTypeId: 0,
    status: VenueStatus.UNPUBLISED,
    photos: [],
    space: [],
    accessCustomData: [],
    id: 10,
}

// @ts-ignore
const userItem: UserEntity = {
	id: 1,
    username : "test",
}

// @ts-ignore
const item: InvoiceEntity = {
	id: 1,
	createdById: TestUserBrandMember.id,
	updatedById: TestUserBrandMember.id,
	createdAt: new Date('2020-07-29 18:12:30.077492+05:30'),
	subTotal: 10,
	paidAmount: 10,
	paid: true,
	tax: 2,
	reservationId: TestReservation.id,
	subscriptionId: TestSubscription.id,
	refundedAmount: 0,
	refund: false,
	invoiceNumber: 123,
	spaceId: TestSpaceMonthlySecond.id,
	venueId: TestSpaceMonthly.venueId,
	autoBillable: false,
	autoSendEmail: false,
	reminderSend: false,
	instantlyBookableRequested: true,
	// @ts-ignore
	instantlyBookReqAutoDecline: null,
	// @ts-ignore
	instantlyBookableResponse: null,
	invoiceStatusId: 1,
	// @ts-ignore
	invoiceStatus: {
		name: 'Paid',
	},
	// @ts-ignore
	space: {},
	// @ts-ignore
	venue: {},
	userId: TestUserBrandMember.id,
	brandId: TestBrandSecond.id,
};

// @ts-ignore
const itemWithinstantlyBookableRequestedFalse: InvoiceEntity = {
	id: 1,
	paidAmount: 10,
	paid: true,
	tax: 2,
	reservationId: TestReservation.id,
	subscriptionId: TestSubscription.id,
	refund: false,
	invoiceNumber: 123,
	spaceId: TestSpaceMonthlySecond.id,
	venueId: TestSpaceMonthly.venueId,
	instantlyBookableRequested: false,
};

// @ts-ignore
const itemWithinstantlyBookableResponseY: InvoiceEntity = {
	id: 11,
	paidAmount: 10,
	paid: true,
	tax: 2,
	reservationId: TestReservation.id,
	subscriptionId: TestSubscription.id,
	refund: false,
	invoiceNumber: 123,
	spaceId: TestSpaceMonthlySecond.id,
	venueId: TestSpaceMonthly.venueId,
	instantlyBookableRequested: false,
    instantlyBookableResponse : 'Y'
};

// @ts-ignore
const itemWithinstantlyBookableResponseN: InvoiceEntity = {
	id: 111,
	paidAmount: 10,
	paid: true,
	tax: 2,
	reservationId: TestReservation.id,
	subscriptionId: TestSubscription.id,
	refund: false,
	invoiceNumber: 123,
	spaceId: TestSpaceMonthlySecond.id,
	venueId: TestSpaceMonthly.venueId,
	instantlyBookableRequested: false,
    instantlyBookableResponse : 'N'
};


// @ts-ignore
const itemAutoDeclined: InvoiceEntity = {
	id: 1,
	paidAmount: 10,
	paid: true,
	tax: 2,
	reservationId: TestReservation.id,
	subscriptionId: TestSubscription.id,
	refund: false,
	invoiceNumber: 123,
	spaceId: TestSpaceMonthlySecond.id,
	venueId: TestSpaceMonthly.venueId,
	autoBillable: false,
	autoSendEmail: false,
	reminderSend: false,
	instantlyBookReqAutoDecline: true,
};

const conversationItem: InstantlyBookableConversationEntity = {
    id: Number(faker.random.numeric(2)),
    friendlyName: `conversation-invoice-${invoiceId}`,
    conversationSid: faker.datatype.uuid(),
    webhookSid: faker.datatype.uuid(),
    proxyNumber: Number(faker.phone.number('516#######')),
    proxyNumberSid: faker.datatype.uuid(),
    isLocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    participants: [],
    venueId: 0,
    spaceId: 0,
    userId: 0,
    isRequested: true,
    isResponded: false,
    space: new SpaceEntity(),
};

const webhookRequest = {
    EventType: 'invalid event',
    ConversationSid: faker.datatype.uuid(),
    ParticipantSid: faker.datatype.uuid(),
    Body: 'Y'
};

const existingMessages = [{
    messageSid: faker.datatype.uuid(),
    participantSid: faker.datatype.uuid(),
    displayName: faker.name.fullName(),
    message: faker.lorem.words(5),
    dateCreated: new Date()
}];

describe('SERVICE: Conversation Service', () => {
    let invoiceRepo: Repository<InvoiceEntity>;
    let veneuRepo: Repository<VenueEntity>;

    let conversationRepository: Repository<InstantlyBookableConversationEntity>;

    beforeAll(() => {
        invoiceRepo = MainDataSource.getRepository(InvoiceEntity);
		invoiceRepo.createQueryBuilder = CreateQueryBuilderMock(item);
        veneuRepo = MainDataSource.getRepository(VenueEntity);
		veneuRepo.createQueryBuilder = CreateQueryBuilderMock(venueItem);
        instantlyBookableConversationService = new InstantlyBookableConversationService();
    });

    beforeEach(() => {
        jest.resetAllMocks();
        conversationRepository = MainDataSource.getRepository(InstantlyBookableConversationEntity);
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

            const conversation = await instantlyBookableConversationService.connect(invoiceId, userId, venueId);

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

            const conversation = await instantlyBookableConversationService.connect(invoiceId, userId, venueId);

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
                await instantlyBookableConversationService.connect(invoiceId, userId, venueId);
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

    describe('method "handleTwilioWebhookRequest"', () => {
        beforeEach(() => {
            jest.spyOn(MainDataSource.getRepository(VenueEntity) as any, 'findOne').mockReturnValue({ venueItem});
            jest.spyOn(MainDataSource.getRepository(UserEntity) as any, 'findOne').mockReturnValue(userItem); 
        });

        it('should throw exception if event type is invalid', async () => {
            const loggerHelperSpy = jest.spyOn(loggerHelper, 'error').mockImplementationOnce(jest.fn());
            try {
                await instantlyBookableConversationService.handleTwilioWebhookRequest(webhookRequest);
            } catch (e: any) {
                expect(loggerHelperSpy).toHaveBeenCalledTimes(1);
                expect(e.message).toEqual(`Invalid event type: ${webhookRequest.EventType}`);
            }
        });

        it('should throw exception if it fails to get conversation', async () => {
            const invoiceData = jest.spyOn(MainDataSource.getRepository(InvoiceEntity) as any, 'findOne').mockReturnValue([item]);
            const existingConversationSpy = jest.spyOn(conversationRepository as any, 'findOne').mockReturnValue(null);
            const loggerHelperSpy = jest.spyOn(loggerHelper, 'error').mockImplementationOnce(jest.fn());
            webhookRequest.EventType = 'onMessageAdded';

            try {
                await instantlyBookableConversationService.handleTwilioWebhookRequest(webhookRequest);
                expect(invoiceData).toHaveBeenCalledTimes(1);
            } catch (e: any) {
                expect(existingConversationSpy).toHaveBeenCalledTimes(1);
                expect(loggerHelperSpy).toHaveBeenCalledTimes(1);
                expect(e.message).toEqual('Invalid conversationSid');
            }
        });

        it('should send SMS to chat participant', async () => {
            const chatConversationParticipant = new InstantlyBookableParticipantEntity();
            chatConversationParticipant.displayName = 'Chat Participant';
            chatConversationParticipant.participantUserId = Number(faker.random.numeric(2));
            chatConversationParticipant.participantSid = faker.datatype.uuid();
            chatConversationParticipant.conversationId = conversationItem.id;
            const venueParticipant = new InstantlyBookableParticipantEntity();
            venueParticipant.displayName = 'Venue Manager';
            venueParticipant.participantUserId = Number(faker.random.numeric(2));
            venueParticipant.participantSid = webhookRequest.ParticipantSid;
            venueParticipant.conversationId = conversationItem.id;
            conversationItem.participants = [chatConversationParticipant, venueParticipant];
            const existingConversationSpy = jest.spyOn(conversationRepository as any, 'findOne').mockReturnValue(conversationItem);
            const loggerHelperSpy = jest.spyOn(loggerHelper, 'error').mockImplementationOnce(jest.fn());
            webhookRequest.EventType = 'onMessageAdded';

            await instantlyBookableConversationService.handleTwilioWebhookRequest(webhookRequest);

            expect(existingConversationSpy).toHaveBeenCalledTimes(1);
            expect(loggerHelperSpy).not.toHaveBeenCalled();
        });

        it('should PAID automatic after getting Y from venue admin', async () => {
            const markAsPaidSpy = jest.spyOn(instantlyBookableConversationService, 'markAsPaidInstantlyBookableItem').mockReturnValue(Promise.resolve(item));
            const sendSMS = jest.spyOn(SendSMSHelper, 'sendSMSInstantlyBookable');
            const venueData = jest.spyOn(veneuRepo as any, 'findOne').mockReturnValue(venueItem);
            const invoiceData = jest.spyOn(invoiceRepo as any, 'findOne').mockReturnValue(item);
            const saveInvoice = jest.spyOn(invoiceRepo as any, 'save').mockReturnValue(item);
            jest.spyOn(MainDataSource.getRepository(InvoiceStatusEntity) as any, 'findOne').mockReturnValue(paidInvoiceStatusList);
            jest.spyOn(MainDataSource.getRepository(SecurityDepositStatusEntity) as any, 'findOne').mockReturnValue(paidInvoiceStatusList);
            jest.spyOn(MainDataSource.getRepository(InvoiceEntity) as any, 'findOne').mockReturnValue(item);
            const chatConversationParticipant = new InstantlyBookableParticipantEntity();
            chatConversationParticipant.displayName = 'Chat Participant';
            chatConversationParticipant.participantUserId = Number(faker.random.numeric(2));
            chatConversationParticipant.participantSid = faker.datatype.uuid();
            chatConversationParticipant.conversationId = conversationItem.id;
            const venueParticipant = new InstantlyBookableParticipantEntity();
            venueParticipant.displayName = 'Venue Manager';
            venueParticipant.participantUserId = Number(faker.random.numeric(2));
            venueParticipant.participantSid = webhookRequest.ParticipantSid;
            venueParticipant.conversationId = conversationItem.id;
            conversationItem.participants = [chatConversationParticipant, venueParticipant];
            const existingConversationSpy = jest.spyOn(conversationRepository as any, 'findOne').mockReturnValue(conversationItem);
            const loggerHelperSpy = jest.spyOn(loggerHelper, 'error').mockImplementationOnce(jest.fn());
            webhookRequest.EventType = 'onMessageAdded';

            await instantlyBookableConversationService.handleTwilioWebhookRequest(webhookRequest);

            expect(existingConversationSpy).toHaveBeenCalledTimes(1);

            expect(invoiceData).toHaveBeenCalledTimes(1);

            expect(venueData).toHaveBeenCalledTimes(1);
            
            expect(sendSMS).toHaveBeenCalledTimes(2);

            expect(saveInvoice).toHaveBeenCalledTimes(1);

            expect(markAsPaidSpy).toHaveBeenCalledTimes(1);

            expect(loggerHelperSpy).not.toHaveBeenCalled();
        });
    });

    describe('method "getBookingRequestStatus"', () => {

        it('should return REQUESTBOOKING', async () => {
           jest.spyOn(MainDataSource.getRepository(InvoiceEntity) as any, 'findOne').mockReturnValue(null);
          const data =  await instantlyBookableConversationService.getBookingRequestStatus(1,item.id,userItem);
           expect(data).toStrictEqual('REQUESTBOOKING');
        });

        it('should return BOOKSPACE', async () => {
            jest.spyOn(MainDataSource.getRepository(InvoiceEntity) as any, 'findOne').mockReturnValue({itemWithinstantlyBookableResponseY});
           const data =  await instantlyBookableConversationService.getBookingRequestStatus(1,item.id,userItem);
            expect(data).toStrictEqual('BOOKSPACE');
         });

         it('should return DECLINED', async () => {
             jest.spyOn(MainDataSource.getRepository(InvoiceEntity) as any, 'findOne').mockReturnValue({itemWithinstantlyBookableResponseN});
            const data =  await instantlyBookableConversationService.getBookingRequestStatus(1,item.id,userItem);
            expect(data).toStrictEqual('DECLINED');
         });
           });
});