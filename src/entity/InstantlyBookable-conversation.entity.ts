import BaseEntity from '@src/entity/base.entity';
import { Column, Entity, JoinColumn, OneToMany, OneToOne } from 'typeorm';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import SpaceEntity from './space.entity';
import InstantlyBookableParticipantEntity from './InstantlyBookable-participant.entity';

/**
 * Conversation entity
 * @category Entities
 * @subcategory Conversation
 * @extends BaseEntity
 */
@Entity({ name: 'InstantlyBookableConversation', schema: 'chat' })
export default class InstantlyBookableConversationEntity extends BaseEntity {

    @IsString()
    @IsNotEmpty()
    @Column()
    @JSONSchema({
        description: 'Friendly name',
        example: 'conversation-invoice-{invoiceId}',
    })
    friendlyName: string;

    @IsString()
    @Column()
    @IsNotEmpty()
    @JSONSchema({
        description: 'Conversation Sid',
        example: 'CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    })
    conversationSid: string;

    @IsOptional()
    @IsString()
    @Column()
    @JSONSchema({
        description: 'Webhook Sid',
        example: 'WHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    })
    webhookSid: string;

    @IsInt()
    @IsOptional()
    @Column()
    @JSONSchema({
        description: 'venue id',
        example: '1202',
    })
    venueId: number;


    @IsInt()
    @IsOptional()
    @Column()
    @JSONSchema({
        description: 'invoice id',
        example: '1202',
    })
    invoiceId: number;


    @IsInt()
	@IsOptional()
    @Column()
    @JSONSchema({
        description: 'space id',
        example: '4121',
    })
    spaceId: number;

    @IsInt()
	@IsOptional()
    @Column()
    @JSONSchema({
        description: 'user id',
        example: '4121',
    })
    userId: number;

    @IsOptional()
    @JSONSchema({
        description: 'Proxy Number',
        example: 3805000000,
    })
    @Column({ type: 'bigint' })
    proxyNumber?: number;

    @IsOptional()
    @IsString()
    @Column()
    @JSONSchema({
        description: 'ProxyNumber Sid',
        example: 'PNXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    })
    proxyNumberSid: string;

    @IsBoolean()
    @IsNotEmpty()
    @JSONSchema({
        description: 'Is Locked?',
        example: true,
        default: false,
    })
    @Column({ default: false })
    isLocked: boolean;

    @IsBoolean()
    @JSONSchema({
        description: 'Is Requested?',
        example: true,
        default: false,
    })
    @Column({ default: false })
    isRequested: boolean;

    @IsBoolean()
    @JSONSchema({
        description: 'Is Responded?',
        example: true,
        default: false,
    })
    @Column({ default: false })
    isResponded: boolean;

    @OneToOne(() => SpaceEntity)
    @JoinColumn({ name: 'spaceId' })
	space: SpaceEntity;
    

    @OneToMany(() => InstantlyBookableParticipantEntity, (participant: InstantlyBookableParticipantEntity) => participant.conversation, { cascade: true })
    participants: InstantlyBookableParticipantEntity[]
}