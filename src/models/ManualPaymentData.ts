import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export default class ManualPaymentData {
  @PrimaryColumn()
  memberId!: string;

  @Column()
  source!: string

  @Column()
  reference!: string
}
