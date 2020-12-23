import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export default class Option {
    @PrimaryColumn()
    key: string;

    @Column()
    value: string;
}
