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

  @Column({ type: String, nullable: true })
  redirectFlowId!: string | null;

  @Column(() => JoinForm)
  joinForm!: JoinForm;
}
