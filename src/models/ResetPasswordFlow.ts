import {
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";
import type Member from "./Member";

@Entity()
export default class ResetPasswordFlow {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne("Member")
  member!: Member;

  @CreateDateColumn()
  date!: Date;
}
