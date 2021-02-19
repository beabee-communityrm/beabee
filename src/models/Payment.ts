import { Column, CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export default abstract class Payment {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Column({nullable: true})
	memberId?: string

	@Column()
	status!: string

	@Column()
	description!: string

	@Column({type: 'real'})
	amount!: number

	@Column({type: 'real', nullable: true})
	amountRefunded!: number

	@Column({type: 'date'})
	chargeDate!: Date

	@CreateDateColumn()
	createdAt!: Date

	@UpdateDateColumn()
	updatedAt!: Date

	abstract get isPending(): boolean
	abstract get isSuccessful(): boolean
}
