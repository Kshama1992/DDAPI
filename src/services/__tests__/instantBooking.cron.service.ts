import MainDataSource from '@src/main-data-source';
import { Repository } from 'typeorm/repository/Repository';
import { CreateQueryBuilderMock } from '@utils/tests/typeorm.mock';
import InstantBookingCronService from '../instantBooking.cron.service';
import InvoiceEntity from '@src/entity/invoice.entity';
import {
	TestBrandSecond,
	TestReservation,
	TestSpaceMonthly,
	TestSpaceMonthlySecond,
	TestSubscription,
	TestUserBrandMember,
} from '@src/utils/tests/base-data';
import InstantlyBookableConversationEntity from '@src/entity/InstantlyBookable-conversation.entity';
import * as SendSMSHelper from  "@src/utils/helpers/host-approval-sms.helper";

let thisService: InstantBookingCronService;

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
const instantlyBookableConversationitem: InstantlyBookableConversationEntity = {
	friendlyName: '',
	conversationSid: '',
	webhookSid: '',
	venueId: 0,
	spaceId: 0,
	userId: 0,
	proxyNumberSid: '',
	isLocked: false,
	isRequested: false,
	isResponded: true,
	participants: [],
	id: 0
};

describe('SERVICE: CRON Service', () => {
	let invoiceRepo: Repository<InvoiceEntity>;
	let InstantlyBookableConversationRepo: Repository<InstantlyBookableConversationEntity>;


	beforeAll(() => {
		thisService = new InstantBookingCronService();
	});

	describe('method "checkResponseForInstBookingRequest"', () => {
		beforeAll(() => {
			jest.resetAllMocks();
			invoiceRepo = MainDataSource.getRepository(InvoiceEntity);
			invoiceRepo.createQueryBuilder = CreateQueryBuilderMock(item);
			jest.spyOn(MainDataSource.getRepository(InvoiceEntity) as any, 'query').mockReturnValue([item]);
		});

		it('check all params for checkResponseForInstBookingRequest', async () => {
			const sendInstBookingReminderSpy = jest.spyOn(thisService, 'sendInstBookingReminder').mockReturnValue(Promise.resolve(true));
            const getTimeFormate = jest.spyOn(SendSMSHelper, 'getTime');

			await thisService.checkResponseForInstBookingRequest();

			expect(invoiceRepo.createQueryBuilder().select).toHaveBeenCalled();
			expect(invoiceRepo.createQueryBuilder().select).toHaveBeenCalledWith([
				'invoice.id',
				'invoice.createdAt',
				'invoice.userId',
				'invoice.venueId',
				'invoice.spaceId',
				'invoice.instantlyBookableRequested',
				'invoice.instantlyBookableResponse',
				'invoice.reminderSend',
			]);

			expect(invoiceRepo.createQueryBuilder().where).toHaveBeenCalledWith(`invoice.reminderSend = false`);
			expect(invoiceRepo.createQueryBuilder().andWhere).toHaveBeenCalledWith(`invoice.instantlyBookReqAutoDecline IS NULL`);
			expect(invoiceRepo.createQueryBuilder().andWhere).toHaveBeenCalledWith(`invoice.instantlyBookableRequested = true`);
			expect(invoiceRepo.createQueryBuilder().andWhere).toHaveBeenCalledWith(`invoice.instantlyBookableResponse IS NULL`);

			expect(invoiceRepo.createQueryBuilder().getMany).toHaveBeenCalledTimes(1);
			expect(getTimeFormate).toHaveBeenCalledTimes(1);
			expect(sendInstBookingReminderSpy).toHaveBeenCalledTimes(1);
		});
	});

	describe('method "markAsAutoDeclineForInstBookingRequest"', () => {
		beforeAll(() => {
			jest.resetAllMocks();
			invoiceRepo = MainDataSource.getRepository(InvoiceEntity);
		});

		it('check all params for markAsAutoDeclineForInstBookingRequest', async () => {
			const invoiceForCurrentDate = { ...item, createdAt: new Date()};
			invoiceRepo.createQueryBuilder = CreateQueryBuilderMock(invoiceForCurrentDate);
			jest.spyOn(MainDataSource.getRepository(InvoiceEntity) as any, 'query').mockReturnValue([invoiceForCurrentDate]);

			const autoDeclineRequestSpy = jest.spyOn(thisService, 'autoDeclineRequest').mockReturnValue(Promise.resolve(invoiceForCurrentDate));
			await thisService.markAsAutoDeclineForInstBookingRequest();

			expect(invoiceRepo.createQueryBuilder().select).toHaveBeenCalled();
			expect(invoiceRepo.createQueryBuilder().select).toHaveBeenCalledWith([
				'invoice.id',
				'invoice.createdAt',
				'invoice.userId',
				'invoice.venueId',
				'invoice.spaceId',
				'invoice.instantlyBookableRequested',
				'invoice.instantlyBookableResponse',
				'invoice.reminderSend',
			]);

			expect(invoiceRepo.createQueryBuilder().where).toHaveBeenCalledWith(`invoice.instantlyBookableRequested = true`);
			expect(invoiceRepo.createQueryBuilder().andWhere).toHaveBeenCalledWith(`invoice.reminderSend = true`);
			expect(invoiceRepo.createQueryBuilder().andWhere).toHaveBeenCalledWith(`invoice.instantlyBookReqAutoDecline IS NULL`);
			expect(invoiceRepo.createQueryBuilder().andWhere).toHaveBeenCalledWith(`invoice.instantlyBookableResponse IS NULL`);
			expect(invoiceRepo.createQueryBuilder().getMany).toHaveBeenCalledTimes(1);

			expect(autoDeclineRequestSpy).toHaveBeenCalledTimes(0);
		});

		it('invoice with created date < 24 hrs', async () => {
			const invoiceForCurrentDate = { ...item, createdAt: new Date()};
			invoiceRepo.createQueryBuilder = CreateQueryBuilderMock(invoiceForCurrentDate);
			jest.spyOn(MainDataSource.getRepository(InvoiceEntity) as any, 'query').mockReturnValue([invoiceForCurrentDate]);

			const autoDeclineRequestSpy = jest.spyOn(thisService, 'autoDeclineRequest').mockReturnValue(Promise.resolve(invoiceForCurrentDate));
			await thisService.markAsAutoDeclineForInstBookingRequest();

			expect(invoiceRepo.createQueryBuilder().select).toHaveBeenCalled();
			expect(invoiceRepo.createQueryBuilder().select).toHaveBeenCalledWith([
				'invoice.id',
				'invoice.createdAt',
				'invoice.userId',
				'invoice.venueId',
				'invoice.spaceId',
				'invoice.instantlyBookableRequested',
				'invoice.instantlyBookableResponse',
				'invoice.reminderSend',
			]);

			expect(invoiceRepo.createQueryBuilder().where).toHaveBeenCalledWith(`invoice.instantlyBookableRequested = true`);
			expect(invoiceRepo.createQueryBuilder().andWhere).toHaveBeenCalledWith(`invoice.reminderSend = true`);
			expect(invoiceRepo.createQueryBuilder().andWhere).toHaveBeenCalledWith(`invoice.instantlyBookReqAutoDecline IS NULL`);
			expect(invoiceRepo.createQueryBuilder().andWhere).toHaveBeenCalledWith(`invoice.instantlyBookableResponse IS NULL`);
			expect(invoiceRepo.createQueryBuilder().getMany).toHaveBeenCalledTimes(1);

			expect(autoDeclineRequestSpy).toHaveBeenCalledTimes(0);
		});

		it('auto decline request for markAsAutoDeclineForInstBookingRequest', async () => {
			invoiceRepo.createQueryBuilder = CreateQueryBuilderMock(item);
			jest.spyOn(MainDataSource.getRepository(InvoiceEntity) as any, 'query').mockReturnValue([item]);

			const autoDeclineRequestSpy = jest.spyOn(thisService, 'autoDeclineRequest').mockReturnValue(Promise.resolve(item));
			await thisService.markAsAutoDeclineForInstBookingRequest();

			expect(invoiceRepo.createQueryBuilder().select).toHaveBeenCalled();
			expect(invoiceRepo.createQueryBuilder().select).toHaveBeenCalledWith([
				'invoice.id',
				'invoice.createdAt',
				'invoice.userId',
				'invoice.venueId',
				'invoice.spaceId',
				'invoice.instantlyBookableRequested',
				'invoice.instantlyBookableResponse',
				'invoice.reminderSend',
			]);

			expect(invoiceRepo.createQueryBuilder().where).toHaveBeenCalledWith(`invoice.instantlyBookableRequested = true`);
			expect(invoiceRepo.createQueryBuilder().andWhere).toHaveBeenCalledWith(`invoice.reminderSend = true`);
			expect(invoiceRepo.createQueryBuilder().andWhere).toHaveBeenCalledWith(`invoice.instantlyBookReqAutoDecline IS NULL`);
			expect(invoiceRepo.createQueryBuilder().andWhere).toHaveBeenCalledWith(`invoice.instantlyBookableResponse IS NULL`);
			expect(invoiceRepo.createQueryBuilder().getMany).toHaveBeenCalledTimes(1);

			expect(autoDeclineRequestSpy).toHaveBeenCalledTimes(1);
		});
	});

	describe('method "processLockInstBookConversations"', () => {
		beforeAll(() => {
			jest.resetAllMocks();
			invoiceRepo = MainDataSource.getRepository(InvoiceEntity);
			InstantlyBookableConversationRepo = MainDataSource.getRepository(InstantlyBookableConversationEntity);
		});

		it('check all params for processLockInstBookConversations', async () => {
			const invoiceForCurrentDate = { ...item, createdAt: new Date()};
			invoiceRepo.createQueryBuilder = CreateQueryBuilderMock(invoiceForCurrentDate);
			InstantlyBookableConversationRepo.createQueryBuilder = CreateQueryBuilderMock(instantlyBookableConversationitem);

			jest.spyOn(MainDataSource.getRepository(InvoiceEntity) as any, 'query').mockReturnValue([invoiceForCurrentDate]);

			await thisService.processLockInstBookConversations();

			expect(InstantlyBookableConversationRepo.createQueryBuilder().select).toHaveBeenCalled();
			expect(InstantlyBookableConversationRepo.createQueryBuilder().select).toHaveBeenCalledWith([
				'InstantlyBookableConversation.id',
				'InstantlyBookableConversation.isLocked',
				'InstantlyBookableConversation.createdAt',
				'InstantlyBookableConversation.conversationSid',
				'InstantlyBookableConversation.proxyNumber',
				'InstantlyBookableConversation.proxyNumberSid'
			]);

			expect(InstantlyBookableConversationRepo.createQueryBuilder().where).toHaveBeenCalledWith(`InstantlyBookableConversation.isLocked = false`);
			expect(InstantlyBookableConversationRepo.createQueryBuilder().andWhere).toHaveBeenCalledWith(`InstantlyBookableConversation.isResponded = true`);
			expect(InstantlyBookableConversationRepo.createQueryBuilder().getMany).toHaveBeenCalledTimes(1);
		});
	});
});
