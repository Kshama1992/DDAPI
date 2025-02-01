import BaseEntity from '@src/entity/base.entity';
import { Column, Entity, ManyToOne } from 'typeorm';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import InstantlyBookableConversationEntity from './InstantlyBookable-conversation.entity';

/**
 * ConversationParticipant entity
 * @category Entities
 * @subcategory ConversationParticipant
 * @extends BaseEntity
 */
@Entity({ name: 'InstantlyBookableParticipant', schema: 'chat' })
export default class InstantlyBookableParticipantEntity extends BaseEntity {

    @IsString()
    @IsNotEmpty()
    @Column()
    @JSONSchema({
        description: 'Display Name',
        example: 'Name to display in chat window',
    })
    displayName: string;

    @IsString()
    @Column()
    @IsNotEmpty()
    @JSONSchema({
        description: 'Participant Sid',
        example: 'MBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    })
    participantSid: string;

    @IsOptional()
    @Column()
    @JSONSchema({
        description: 'Participant User Id',
        example: 123,
    })
    participantUserId?: number;
    
    @IsOptional()
    @JSONSchema({
        description: 'Phone Number',
        example: 3805000000,
    })
    @Column({ type: 'bigint' })
    phoneNumber?: number;

    @Column()
    @IsNotEmpty()
    @JSONSchema({
        description: 'Conversation Id',
        example: 123,
    })
    conversationId: number;

    @IsString()
    @Column()
    @JSONSchema({
        description: 'user Name',
        example: 'Name to display in inbox',
    })
    username: string;

    @ManyToOne(() => InstantlyBookableConversationEntity, (conversation: InstantlyBookableConversationEntity) => conversation.participants, { orphanedRowAction: 'delete' })
    conversation: InstantlyBookableConversationEntity
}