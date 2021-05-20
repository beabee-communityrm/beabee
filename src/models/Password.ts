import { Column } from 'typeorm';

export default class Password {
	@Column()
	hash!: string;

	@Column()
	salt!: string;

	@Column({ default: 1000 })
	iterations!: number;

	@Column({ default: 0 })
	tries!: number;

	@Column({ nullable: true })
	resetCode?: string;
}
