import BaseEntity from '@src/entity/base.entity';
import { Column, Entity, JoinColumn, OneToMany, OneToOne } from 'typeorm';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import ConversationParticipantEntity from '@src/entity/conversation-participant.entity';
import SpaceEntity from './space.entity';
import InvoiceEntity from './invoice.entity';
import UserEntity from './user.entity';

/**
 * Conversation entity
 * @category Entities
 * @subcategory Conversation
 * @extends BaseEntity
 */
@Entity({ name: 'Conversation', schema: 'chat' })
export default class ConversationEntity extends BaseEntity {

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
        description: 'invoice id',
        example: '1202',
    })
    invoiceid: number;

    @IsInt()
	@IsOptional()
    @Column()
    @JSONSchema({
        description: 'space id',
        example: '4121',
    })
    spaceid: number;

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

    @OneToOne(() => SpaceEntity)
    @JoinColumn({ name: 'spaceid' })
	space: SpaceEntity;

    @OneToOne(() => UserEntity)
	requestedByUser: UserEntity | null;
    
    @OneToOne(() => InvoiceEntity)
    @JoinColumn({ name: 'invoiceid' })
    invoice: InvoiceEntity;

    @OneToMany(() => ConversationParticipantEntity, (participant: ConversationParticipantEntity) => participant.conversation, { cascade: true })
    participants: ConversationParticipantEntity[]
}