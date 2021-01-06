import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export class Address {
  @Column()
  line1!: string

  @Column({nullable: true})
  line2?: string

  @Column()
  city!: string

  @Column()
  postcode!: string
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

  @Column({nullable: true})
  giftAddress?: Address

  @Column({nullable: true})
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
  
  @Column()
  giftForm!: GiftForm

  @Column({default: false})
  completed!: boolean

  @Column({default: false})
  processed!: boolean
}
