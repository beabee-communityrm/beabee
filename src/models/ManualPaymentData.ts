import { Column, Entity, ManyToOne } from 'typeorm';
import type Member from './Member';

@Entity()
export default class ManualPaymentData {
  @ManyToOne('Member', {primary: true})
  member!: Member;

  @Column()
  source!: string

  @Column()
  reference!: string
}
