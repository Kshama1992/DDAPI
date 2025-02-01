import { faker } from '@faker-js/faker';
import MainDataSource from '@src/main-data-source';
import { Repository } from 'typeorm/repository/Repository';
import { CreateQueryBuilderMock } from '@utils/tests/typeorm.mock';
import SpaceEntity from "@entity/space.entity";
import CronService from "@services/cron.service";
import { SpaceStatus } from 'dd-common-blocks';
import ConversationEntity from '@entity/conversation.entity';
import * as loggerHelperModule from '@helpers/logger.helper';
import * as twilioConversationsHelper from '@helpers/twilio-conversations.helper';

let thisService: CronService;

const cronSpaceItem: Partial<SpaceEntity> = {
	id: Number(faker.random.numeric(2)),
	quantityRepublish: Number(faker.random.numeric(2)),
	quantityRepublishCustom: Number(faker.random.numeric(2)),
	renewedAt: faker.date.recent(1),
	status: SpaceStatus.UNPUBLISED,
	createdAt: new Date(),
	updatedAt: new Date(),
};

const cronConversationItem: Partial<ConversationEntity> = {
	id: Number(faker.random.numeric(2)),
    friendlyName:`conversation-invoice-${Number(faker.random.numeric(2))}`,
	conversationSid: faker.datatype.uuid(),
    proxyNumber: Number(faker.phone.number('516#######')),
    proxyNumberSid: faker.datatype.uuid(),
    isLocked: false,
	createdAt: new Date(),
	updatedAt: new Date(),
};

describe('SERVICE: CRON Service', () => {
	let spaceRepo: Repository<SpaceEntity>;
    let conversationRepository: Repository<ConversationEntity>;

	beforeAll(() => {
		thisService = new CronService();
	});

	beforeEach(() => {
        jest.resetAllMocks();
		spaceRepo = MainDataSource.getRepository(SpaceEntity);
		spaceRepo.createQueryBuilder = CreateQueryBuilderMock(cronSpaceItem);
        conversationRepository = MainDataSource.getRepository(ConversationEntity);
		conversationRepository.createQueryBuilder = CreateQueryBuilderMock(cronConversationItem);
	});

	describe('method "processSpacesRepublish"', () => {
		it('call should return and update one space', async () => {
			const updatedSpace = { ...cronSpaceItem, renewedAt: new Date(), usedQuantity: 0, status: SpaceStatus.PUBLISH };

			const saveSpaceSpy = jest.spyOn(spaceRepo as any, 'save').mockReturnValue(async() => Promise.resolve(updatedSpace));

			await thisService.processSpacesRepublish();

			expect(spaceRepo.createQueryBuilder().select).toHaveBeenCalledWith(['space.id', 'space.quantityRepublish', 'space.quantityRepublishCustom', 'space.renewedAt', 'space.status']);

			expect(spaceRepo.createQueryBuilder().where).toHaveBeenCalledWith('space.status = :status', {status: SpaceStatus.UNPUBLISED});

			expect(spaceRepo.createQueryBuilder().andWhere).toHaveBeenCalledWith('space.quantityUnlimited = false');

			expect(spaceRepo.createQueryBuilder().andWhere).toHaveBeenCalledWith('(extract(epoch from age(now(), "renewedAt"))/3600 > "quantityRepublish" or extract(epoch from age(now(), "renewedAt"))/3600 > "quantityRepublishCustom")');

			expect(spaceRepo.createQueryBuilder().getMany).toHaveBeenCalled();

			expect(saveSpaceSpy).toHaveBeenCalledTimes(1);
		});
	});

    describe('method "processLockConversations"', () => {
		it('should update isLocked column', async () => {
			const saveConversationSpy = jest.spyOn(conversationRepository as any, 'save').mockReturnValue(null);
            const writeLogSpy = jest.spyOn(thisService as any, 'writeLog').mockImplementation(jest.fn());
            const cronLoggerHelperSpy = jest.spyOn(loggerHelperModule.cronLoggerHelper as any, 'error').mockImplementationOnce(jest.fn());
            const removeTwilioConversationParticipantsSpy = jest.spyOn(twilioConversationsHelper, 'removeTwilioConversationParticipants').mockImplementationOnce(jest.fn());
            const releaseTwilioPhoneNumberSpy = jest.spyOn(twilioConversationsHelper, 'releaseTwilioPhoneNumber').mockImplementationOnce(jest.fn());

			await thisService.processLockConversations();

			expect(conversationRepository.createQueryBuilder().select).toHaveBeenCalledWith(['Conversation.id', 'Conversation.isLocked', 'Conversation.createdAt', 'Conversation.conversationSid', 'Conversation.proxyNumber', 'Conversation.proxyNumberSid']);
			expect(conversationRepository.createQueryBuilder().where).toHaveBeenCalledWith('Conversation.isLocked = false');
			expect(conversationRepository.createQueryBuilder().andWhere).toHaveBeenCalledWith('(CURRENT_DATE - "Conversation"."createdAt"::DATE) >= :noOfDays', { noOfDays: 21 });
			expect(conversationRepository.createQueryBuilder().getMany).toHaveBeenCalled();
			expect(saveConversationSpy).toHaveBeenCalledTimes(1);
            expect(cronLoggerHelperSpy).not.toHaveBeenCalled();
            expect(writeLogSpy).toHaveBeenCalledTimes(3);
            expect(removeTwilioConversationParticipantsSpy).toHaveBeenCalledTimes(1);
            expect(releaseTwilioPhoneNumberSpy).toHaveBeenCalledTimes(1);
		});

        it('should log exception when the method fails', async () => {
			const saveConversationSpy = jest.spyOn(conversationRepository as any, 'save').mockImplementationOnce(async () => {throw new Error('error occured')});
            const writeLogSpy = jest.spyOn(thisService as any, 'writeLog').mockImplementation(jest.fn());
            const cronLoggerHelperSpy = jest.spyOn(loggerHelperModule.cronLoggerHelper as any, 'error').mockImplementationOnce(jest.fn());
            const removeTwilioConversationParticipantsSpy = jest.spyOn(twilioConversationsHelper, 'removeTwilioConversationParticipants').mockImplementationOnce(jest.fn());
            const releaseTwilioPhoneNumberSpy = jest.spyOn(twilioConversationsHelper, 'releaseTwilioPhoneNumber').mockImplementationOnce(jest.fn());

			await thisService.processLockConversations();

			expect(conversationRepository.createQueryBuilder().select).toHaveBeenCalledWith(['Conversation.id', 'Conversation.isLocked', 'Conversation.createdAt', 'Conversation.conversationSid', 'Conversation.proxyNumber', 'Conversation.proxyNumberSid']);
			expect(conversationRepository.createQueryBuilder().where).toHaveBeenCalledWith('Conversation.isLocked = false');
			expect(conversationRepository.createQueryBuilder().andWhere).toHaveBeenCalledWith('(CURRENT_DATE - "Conversation"."createdAt"::DATE) >= :noOfDays', { noOfDays: 21 });
			expect(conversationRepository.createQueryBuilder().getMany).toHaveBeenCalled();
			expect(saveConversationSpy).toHaveBeenCalledTimes(1);
            expect(cronLoggerHelperSpy).toHaveBeenCalledTimes(1);
            expect(saveConversationSpy).toThrowError();
            expect(writeLogSpy).toHaveBeenCalledTimes(3);
            expect(removeTwilioConversationParticipantsSpy).toHaveBeenCalledTimes(1);
            expect(releaseTwilioPhoneNumberSpy).toHaveBeenCalledTimes(1);
		});
	});
});
