import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export default class Email {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @CreateDateColumn()
    date: Date;

    @Column()
    name: string;

    @Column()
    fromName: string

    @Column()
    fromEmail: string

    @Column()
    subject: string

    @Column({type: 'text'})
    body: string
}
