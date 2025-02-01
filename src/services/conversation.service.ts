import { Service } from "typedi";
import Socket from '@src/socket';
import UserEntity from '@entity/user.entity';
import ConversationEntity from '@entity/conversation.entity';
import BaseService from '@services/base.service';
import MainDataSource from '@src/main-data-source';
import {
    addTwilioChatParticipant,
    addTwilioSMSParticipant,
    createTwilioConversation,
    sendTwilioMessage,
    createTwilioConversationScopedWebhook,
    getMessagesFromConversation,
    removeTwilioConversationParticipants,
    getTwilioPhoneNumbers,
    purchaseTwilioPhoneNumber
} from '@helpers/twilio-conversations.helper';
import ConversationParticipantEntity from "@entity/conversation-participant.entity";
import loggerHelper from "@utils/helpers/logger.helper";
import VenueEntity from "@entity/venue.entity";
import ConversationResp from "@src/dto/response/conversation.resp";
import InvoiceService from "./invoice.service";
import InvoiceEntity from "@src/entity/invoice.entity";
import { sendPushNotification } from "@src/utils/helpers/send-push-notifications-helper";
import UserAdminVenueEntity from "@src/entity/user-venue-admin.entity";
import { In } from "typeorm";

@Service()
export default class ConversationService extends BaseService {

    async connect(invoiceId: string): Promise<ConversationResp> {
        const invoiceService = new InvoiceService();
        const friendlyName = `conversation-invoice-${invoiceId}`;
        let spaceId = '';
        let invId = '';
        let requestedById = '';
        
        const arr = (String(invoiceId).indexOf('-') > -1)? invoiceId.split("-") : [invoiceId];
        if(arr.length == 1){
            const invoice = (await invoiceService.singleWithoutUpdate(Number(invoiceId))) as unknown as InvoiceEntity;
            spaceId = String(invoice?.space?.id);
            invId = invoiceId;
        }
        if(arr.length > 1){
            spaceId = arr[1];
            requestedById = arr[0];
        }
        const conversationRepository = MainDataSource.getRepository(ConversationEntity);
        try {
            const existingConversation = await conversationRepository.findOne({
                where: { friendlyName },
                relations: ['participants'],
                select: ['id', 'friendlyName', 'conversationSid', 'isLocked', 'participants', 'createdAt']
            });
            if (existingConversation) {
                const existingMessages = await getMessagesFromConversation(existingConversation.conversationSid);
                existingMessages.forEach((message) => {
                    const participant = existingConversation.participants.find((participant) => participant.participantSid === message.participantSid);
                    if (participant) message.displayName = participant.displayName;
                });
                const userRepository = await MainDataSource.getRepository(UserEntity);
                if(requestedById!=''){
                    const requestedByUser = await userRepository.findOne({where: {id: Number(requestedById)},
                    relations: ['photo']});
                    existingConversation.requestedByUser = requestedByUser;
                }
               
                return { conversation: existingConversation, messages: existingMessages };
            }
            const { conversationSid } = await createTwilioConversation(friendlyName);
            const { webhookSid } = await createTwilioConversationScopedWebhook(conversationSid);
            const newConversation = conversationRepository.create({
                friendlyName,
                conversationSid,
                webhookSid,
                invoiceid: Number(invId),
                spaceid: Number(spaceId)
            });
            const savedConversation = await conversationRepository.save(newConversation);
            return { conversation: savedConversation, messages: [] };
        } catch (e) {
            loggerHelper.error('Failed to get or create new conversation - ', e);
            throw e;
        }
    }
    isFcmTokenActive(user: UserEntity|null): boolean {
        console.log("inside isFcmTokenActive "+ JSON.stringify(user));
          return user != null && user.isfcmtokenactive ;        
    }
    async getVenueAdminTokens(venueId : Number) : Promise<(string[])>{
        const userRepository = MainDataSource.getRepository(UserEntity);
        const adminlist = await MainDataSource.getRepository(UserAdminVenueEntity)
                .createQueryBuilder('UserAdminVenue')
                 .where('UserAdminVenue.venueId = :venueId', { venueId: venueId})
                .orderBy('UserAdminVenue.userId', 'ASC')
                .getRawMany();
                if(adminlist.length > 0 ){
                   const venueAdmins = await userRepository.find({ where: {id : In([...adminlist.map(i => i.UserAdminVenue_userId)]) }});
                   const venueAdminTokens = venueAdmins.filter((i) => i.fcmtoken != null && i.isfcmtokenactive != false)
					.map((i) => String(i.fcmtoken));
                    return venueAdminTokens;
                }
        return [];
    }
    async sendMessage(conversationSid: string, messageBody: string, venueId: number, requestedByUser?: UserEntity, reservedToUserId?: number, isAdmin? : boolean): Promise<{ messageSid: string }> {
        const conversationRepository = MainDataSource.getRepository(ConversationEntity);
        try {
            const userRepository = MainDataSource.getRepository(UserEntity);
            const existingConversation = await conversationRepository.findOne({
                where: { conversationSid, isLocked: false },
                relations: ['participants']
            });
            if (!existingConversation) throw new Error('Invalid conversationSid');
            if(!isAdmin) {
                const venueRepository = MainDataSource.getRepository(VenueEntity);
                const venue = await venueRepository.findOne({ where: { id: venueId } });
                const messageBodyDetails = "DropDesk Member: " +requestedByUser?.firstname+ " says";

            if (existingConversation.proxyNumber && existingConversation.participants.length === 3 || existingConversation.participants.length === 4 ) {
                const venueAdminPhone = existingConversation.participants.filter((i) => (i.phoneNumber != requestedByUser?.phone && i.phoneNumber != null ) );
                if(venueAdminPhone && venueAdminPhone[0]?.phoneNumber){
                 const venueAdmin = await userRepository.findOne({ where: { phone: venueAdminPhone[0]?.phoneNumber }});
                 if(venueAdmin!=null && this.isFcmTokenActive(venueAdmin)){
                    console.log("sending push noticfication to venue admin for existing conversation "+ JSON.stringify(venueAdmin));
                sendPushNotification([String(venueAdmin?.fcmtoken)] ,messageBodyDetails+" :", messageBody , 'Inbox', messageBody);
                }
                if(venueAdmin == null){
                    const venueAdminTokens = this.getVenueAdminTokens(Number(venueId));
                    if(venueAdminTokens != null)
                    {
                        sendPushNotification(await venueAdminTokens ,messageBodyDetails+" :", messageBody , 'Inbox', messageBody);
                    }
                }
                }
                const data = await sendTwilioMessage(conversationSid, `${messageBodyDetails}: ${'"'+messageBody+'"'}`, requestedByUser?.username);
                this.sendNotificationToUser(existingConversation.friendlyName, String(requestedByUser?.id), {
                    displayName: requestedByUser?.username,
                    message: messageBody,
                    dateCreated: data.dateCreated
                });
                return data;
            }

            if (!venue) throw new Error('Invalid venueId');

            await removeTwilioConversationParticipants(conversationSid);

            if (!existingConversation.proxyNumber) {
                const twilioPhoneNumbers = await getTwilioPhoneNumbers();
                const result = await purchaseTwilioPhoneNumber(twilioPhoneNumbers[0].phoneNumber);               
                loggerHelper.info(`Purchased number: ${result.twilioPhoneNumber}`);
                existingConversation.proxyNumber = Number(result.twilioPhoneNumber);
                existingConversation.proxyNumberSid = result.twilioPhoneNumberSid;
                await conversationRepository.save(existingConversation);
            }

            const userDisplayName = requestedByUser ? requestedByUser.username : '';
            const chatParticipant = await addTwilioChatParticipant(conversationSid, userDisplayName);
            const chatConversationParticipant = new ConversationParticipantEntity();
            chatConversationParticipant.displayName = userDisplayName;
            chatConversationParticipant.participantUserId = requestedByUser?.id;
            chatConversationParticipant.participantSid = chatParticipant.participantSid;
            chatConversationParticipant.conversationId = existingConversation.id;
            chatConversationParticipant.username = requestedByUser?.firstname + " " + requestedByUser?.lastname;

            const chatParticipant2 = await addTwilioChatParticipant(conversationSid, 'Venue Manager');
            const chatVenueConversationParticipant = new ConversationParticipantEntity();
            chatVenueConversationParticipant.displayName = 'Venue Manager';
            chatVenueConversationParticipant.participantUserId = venue?.id;
            chatVenueConversationParticipant.participantSid = chatParticipant2.participantSid;
            chatVenueConversationParticipant.conversationId = existingConversation.id;
            chatVenueConversationParticipant.username  = 'Venue Manager';

            const userParticipant = await addTwilioSMSParticipant(conversationSid, `+${existingConversation.proxyNumber}`, false,0, String(requestedByUser?.phone));
            const userConversationParticipant = new ConversationParticipantEntity();
            if(userParticipant.participantSid!=undefined)
            userConversationParticipant.participantSid = userParticipant.participantSid; 
            userConversationParticipant.displayName = userDisplayName;
            userConversationParticipant.phoneNumber = requestedByUser?.phone;
            userConversationParticipant.conversationId = existingConversation.id;
            userConversationParticipant.username = requestedByUser?.firstname + " " + requestedByUser?.lastname;

            const venueParticipant = await addTwilioSMSParticipant(conversationSid, `+${existingConversation.proxyNumber}`,true, venue.id , String(venue.phone));
            const venueConversationParticipant = new ConversationParticipantEntity();
            if(venueParticipant.participantSid!=undefined)
            venueConversationParticipant.participantSid = venueParticipant.participantSid;
            venueConversationParticipant.displayName = 'Venue Manager';
            venueConversationParticipant.phoneNumber = venue.phone;
            venueConversationParticipant.conversationId = existingConversation.id;
            venueConversationParticipant.username  = 'Venue Manager';

            existingConversation.participants = [chatConversationParticipant, chatVenueConversationParticipant ,userConversationParticipant, venueConversationParticipant];
            await conversationRepository.save(existingConversation);            
            const data = await sendTwilioMessage(conversationSid, `${messageBodyDetails}: ${'"'+messageBody+'"'}`, requestedByUser?.username);
            if(venueParticipant.adminPhone != undefined){
                const venueAdmin = await userRepository.findOne({ where: { phone: Number(venueParticipant.adminPhone) }});
                if(venueAdmin!=null && this.isFcmTokenActive(venueAdmin)){
                    console.log("sending push noticfication to venue admin for new conversation "+ JSON.stringify(venueAdmin));
                sendPushNotification([String(venueAdmin?.fcmtoken)],messageBodyDetails+" :", messageBody, 'Inbox', messageBody)
            }
            if(venueAdmin == null){
                const venueAdminTokens = this.getVenueAdminTokens(Number(venueId));
                if(venueAdminTokens != null)
                {
                    sendPushNotification(await venueAdminTokens ,messageBodyDetails+" :", messageBody , 'Inbox', messageBody);
                }
            }
        }
            this.sendNotificationToUser(existingConversation.friendlyName, String(requestedByUser?.id), {
                displayName: userDisplayName,
                message: messageBody,
                dateCreated: data.dateCreated
            });
            return data; 
        }
        else{
            const venueRepository = MainDataSource.getRepository(VenueEntity);
            
            const venue = await venueRepository.findOne({ where: { id: venueId } });
            const reservedToUser = await userRepository.findOne({where: {id: reservedToUserId}});
            if (existingConversation.proxyNumber && existingConversation.participants.length === 3 || existingConversation.participants.length === 4 ) {                
                const data = await sendTwilioMessage(conversationSid, `${"DropDesk Host: "+requestedByUser?.firstname+ " says"}: ${'"'+messageBody+'"'}`, 'Venue Manager');
                if(this.isFcmTokenActive(reservedToUser)){
                    console.log("sending push noticfication to user for existing conversation "+ JSON.stringify(reservedToUser));
                sendPushNotification([String(reservedToUser?.fcmtoken)],"DropDesk Host: "+requestedByUser?.firstname+ " says :", messageBody , 'Inbox', messageBody)}
              this.sendNotificationToUser(existingConversation.friendlyName, String(requestedByUser?.id), {
                    displayName: 'Venue Manager',
                    message: messageBody,
                    dateCreated: data.dateCreated
                });
                return data;
            }

            if (!venue) throw new Error('Invalid venueId');
            await removeTwilioConversationParticipants(conversationSid);

            if (!existingConversation.proxyNumber) {
                const twilioPhoneNumbers = await getTwilioPhoneNumbers();
               const result = await purchaseTwilioPhoneNumber(twilioPhoneNumbers[0].phoneNumber);
                loggerHelper.info(`Purchased number: ${result.twilioPhoneNumber}`);
                existingConversation.proxyNumber = Number(result.twilioPhoneNumber);
                existingConversation.proxyNumberSid = result.twilioPhoneNumberSid;
                await conversationRepository.save(existingConversation);
            }

            const userDisplayName = reservedToUser ? reservedToUser.username : '';
            const chatParticipant = await addTwilioChatParticipant(conversationSid, userDisplayName);
            const chatConversationParticipant = new ConversationParticipantEntity();
            chatConversationParticipant.displayName = userDisplayName;
            chatConversationParticipant.participantUserId = reservedToUser?.id;
            chatConversationParticipant.participantSid = chatParticipant.participantSid;
            chatConversationParticipant.conversationId = existingConversation.id;
            chatConversationParticipant.username = reservedToUser?.firstname + " " + reservedToUser?.lastname;

            const chatParticipant2 = await addTwilioChatParticipant(conversationSid, 'Venue Manager');
            const chatVenueConversationParticipant = new ConversationParticipantEntity();
            chatVenueConversationParticipant.displayName = 'Venue Manager';
            chatVenueConversationParticipant.participantUserId = venue?.id;
            chatVenueConversationParticipant.participantSid = chatParticipant2.participantSid;
            chatVenueConversationParticipant.conversationId = existingConversation.id;
            chatVenueConversationParticipant.username = requestedByUser?.firstname + " " + requestedByUser?.lastname;

            const userParticipant = await addTwilioSMSParticipant(conversationSid, `+${existingConversation.proxyNumber}`,false,0, String(reservedToUser?.phone));
            const userConversationParticipant = new ConversationParticipantEntity();
            if(userParticipant.participantSid!=undefined)
            userConversationParticipant.participantSid = userParticipant.participantSid;            
            userConversationParticipant.displayName = String(reservedToUser?.username);            
            userConversationParticipant.phoneNumber = reservedToUser?.phone;
            userConversationParticipant.conversationId = existingConversation.id;
            userConversationParticipant.username = reservedToUser?.firstname + " " + reservedToUser?.lastname;

            const venueParticipant = await addTwilioSMSParticipant(conversationSid, `+${existingConversation.proxyNumber}`,true ,venue.id, String(venue.phone));
            const venueConversationParticipant = new ConversationParticipantEntity();
            if(venueParticipant.participantSid!=undefined)
            venueConversationParticipant.participantSid = venueParticipant.participantSid;
            venueConversationParticipant.displayName = 'Venue Manager';
            venueConversationParticipant.phoneNumber = venue.phone;
            venueConversationParticipant.conversationId = existingConversation.id;
            venueConversationParticipant.username = requestedByUser?.firstname + " " + requestedByUser?.lastname;

            existingConversation.participants = [chatConversationParticipant, chatVenueConversationParticipant, userConversationParticipant, venueConversationParticipant ];
            await conversationRepository.save(existingConversation);            
            const data = await sendTwilioMessage(conversationSid, `${"DropDesk Host: "+requestedByUser?.firstname+ " says"}: ${'"'+messageBody+'"'}`, 'Venue Manager');
            if(this.isFcmTokenActive(reservedToUser)){
                console.log("sending push noticfication to user for new conversation "+ JSON.stringify(reservedToUser));
            sendPushNotification([String(reservedToUser?.fcmtoken)],"DropDesk Host: "+ requestedByUser?.firstname+ " says :", messageBody, 'Inbox', messageBody)}
            this.sendNotificationToUser(existingConversation.friendlyName, String(requestedByUser?.id), {
                displayName: 'Venue Manager',
                message: messageBody,
                dateCreated: data.dateCreated
            });
            return data; 
        }
        } catch (e) {
            loggerHelper.error('Failed to send message - ', e);
            throw e;
        }
    }

    async handleTwilioWebhookRequest(request: any): Promise<void> {
        try {
            switch (request.EventType) {
                case 'onMessageAdded':
                    await this.onMessageAddedHandler(request);
                    break;
                default:
                    throw new Error(`Invalid event type: ${request.EventType}`);
            }
        } catch (e) {
            loggerHelper.error('Failed to handle twilio webhook request - ', e);
            throw e;
        }
    }

    sendNotificationToUser(socketEventType: string, userId: string, data?: any): void {
        Socket.connection().sendEventToUser(userId, socketEventType, data || {});
    }

    private async onMessageAddedHandler(request: any): Promise<void> {
        const conversationRepository = MainDataSource.getRepository(ConversationEntity);
        const existingConversation = await conversationRepository.findOne({
            where: { conversationSid: request.ConversationSid },
            relations: ['participants']
        });
        if (!existingConversation) throw new Error('Invalid conversationSid');
        //for participants.length == 2 it will be instBookable, for participants.length !=2 always be conversation one
        if(existingConversation.participants.length !== 2)
        {
        const chatParticipant = existingConversation.participants.find((participant) => !participant.phoneNumber);
        const smsParticipant = existingConversation.participants.find((participant) => participant.participantSid === request.ParticipantSid);
        this.sendNotificationToUser(existingConversation.friendlyName, String(chatParticipant?.participantUserId), {
            displayName: smsParticipant?.displayName,
            message: request.Body,
            dateCreated: request.DateCreated
        });
    }
    }
    async getConversations(userId : string): Promise< ConversationEntity[] | null>{
        try {
            var participantsIds =[userId];
            const user = await MainDataSource.getRepository(UserEntity).findOneOrFail({
				where: { id: Number(userId) },
				relations: ['adminVenues'],
			});
            if(user?.isAdmin && user?.adminVenues!= null){
                participantsIds = (user.adminVenues.map(venue => String(venue.id)));
            }
            let query = MainDataSource.getRepository(ConversationEntity)
            .createQueryBuilder('Conversation')
            .leftJoinAndSelect('Conversation.participants', 'participants')
            .queryAndWhere(`participants.participantUserId IN (:...participantsIds)`, { participantsIds });
            let conversationsList = await query.getMany();
            const convIdsList = conversationsList.map(item => item.id);

            query = MainDataSource.getRepository(ConversationEntity)
            .createQueryBuilder('Conversation')
            .leftJoinAndSelect('Conversation.participants', 'participants') //space
            .leftJoinAndSelect('Conversation.invoice', 'invoice')
            .leftJoinAndSelect('invoice.reservation', 'reservation')
            .leftJoinAndSelect('reservation.reservedTo', 'reservedTo')
            .leftJoinAndSelect('Conversation.space', 'space')
            .leftJoinAndSelect('space.venue', 'venue') 
            .leftJoinAndSelect('space.spaceType', 'spaceType')
            .leftJoinAndSelect('space.photos', 'spacePhotos')  
            .leftJoinAndSelect('venue.photos', 'venuePhotos')  
            .leftJoinAndSelect('venue.venueAdmins', 'venueAdmins')
			.leftJoinAndSelect('venueAdmins.photo', 'photo')       
            .queryAndWhere(`Conversation.id IN (:...convIdsList)`, { convIdsList });
            conversationsList = await query.getMany();
            return conversationsList ;
        }
        catch (e) {
            loggerHelper.error('Error in fetching converstions fot user: '+ userId );
            return null;
        }
    }
}