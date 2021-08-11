import {
  Column,
  CreateDateColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";
import type Member from "./Member";

export default abstract class Payment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne("Member", { nullable: true })
  member?: Member;

  @Column()
  status!: string;

  @Column()
  description!: string;

  @Column({ type: "real" })
  amount!: number;

  @Column({ type: "real", nullable: true })
  amountRefunded!: number;

  @Column({ type: "date" })
  chargeDate!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  abstract get isPending(): boolean;
  abstract get isSuccessful(): boolean;
}
