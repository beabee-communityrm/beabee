import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export interface Address {
  line1: string
  line2?: string
  city: string
  postcode: string
}

export class GiftForm {
  @Column()
  firstname!: string

  @Column()
  lastname!: string

  @Column()
  email!: string
  
  @Column({type: 'date'})
  startDate!: Date

  @Column({nullable: true})
  message?: string

  @Column()
  fromName!: string

  @Column()
  fromEmail!: string

  @Column()
  months!: number

  @Column({type: 'jsonb'})
  giftAddress?: Address

  @Column({type: 'jsonb'})
  deliveryAddress?: Address
}

@Entity()
export default class GiftFlow {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @CreateDateColumn()
  date!: Date

  @Column()
  sessionId!: string

  @Column({unique: true})
  setupCode!: string
  
  @Column(() => GiftForm)
  giftForm!: GiftForm

  @Column({default: false})
  completed!: boolean

  @Column({default: false})
  processed!: boolean
}
