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

  @Column({ nullable: true })
  redirectFlowId: string | undefined;

  @Column(() => JoinForm)
  joinForm!: JoinForm;
}
