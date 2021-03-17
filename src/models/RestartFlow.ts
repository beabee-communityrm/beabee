import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { JoinForm } from './JoinFlow';
import type Member from './Member';

@Entity()
export default class RestartFlow {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@CreateDateColumn()
	date!: Date;

	@ManyToOne('Member')
	member!: Member;

	@Column()
	customerId!: string;

	@Column()
	mandateId!: string;

	@Column(() => JoinForm)
	joinForm!: JoinForm;
}
