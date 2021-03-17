import { Column, Entity, ManyToOne } from 'typeorm';
import type Member from './Member';

@Entity()
export default class GCPaymentData {
  @ManyToOne('Member', {primary: true})
  member!: Member;

  @Column({ nullable: true })
  customerId?: string;

  @Column({ nullable: true })
  mandateId?: string;

  @Column({ nullable: true })
  subscriptionId?: string;

  @Column({ nullable: true })
  cancelledAt?: Date;

  @Column({nullable: true})
  payFee?: boolean;
}
