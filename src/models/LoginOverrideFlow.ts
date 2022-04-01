import { differenceInHours } from "date-fns";
import {
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";
import type Member from "./Member";

@Entity()
export default class LoginOverrideFlow {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne("Member")
  member!: Member;

  @CreateDateColumn()
  date!: Date;

  get isValid(): boolean {
    return differenceInHours(new Date(), this.date) < 12;
  }
}
