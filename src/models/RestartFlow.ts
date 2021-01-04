import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { JoinForm } from '@models/JoinFlow';

@Entity()
export default class RestartFlow {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@CreateDateColumn()
	date!: Date;

	@Column()
	memberId!: string;

	@Column()
	customerId!: string;

	@Column()
	mandateId!: string;

	@Column(type => JoinForm)
	joinForm!: JoinForm;
}
