import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export default class GCPaymentData {
  @PrimaryColumn()
  memberId!: string;

  @Column({ nullable: true })
  customerId?: string;

  @Column({ nullable: true })
  mandateId?: string;

  @Column({ nullable: true })
  subscriptionId?: string;

  @Column({ nullable: true })
  cancelledAt?: Date;

  @Column()
  payFee!: boolean;
}
