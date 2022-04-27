import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn
} from "typeorm";

import JoinForm from "./JoinForm";

@Entity()
export default class JoinFlow {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @CreateDateColumn()
  date!: Date;

  @Column()
  paymentFlowId!: string;

  @Column(() => JoinForm)
  joinForm!: JoinForm;
}
