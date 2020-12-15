import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import TransactionalEmail from '@models/TransactionalEmail';

export type TransactionalEmailRecipient = Record<string, string>;

@Entity()
export default class TransactionalEmailSend {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => TransactionalEmail)
    parent: TransactionalEmail;

    @CreateDateColumn()
    createdDate: Date;

    @Column({nullable: true})
    sentDate?: Date;

    @Column({type: 'jsonb'})
    recipients: TransactionalEmailRecipient[];

    @Column()
    emailField?: string

    @Column()
    nameField?: string

    @Column({type: 'json', nullable: true})
    mergeFields?: Record<string, string>;
}
