import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";
import { ItemWithStatus } from "./ItemStatus";

@Entity()
export default class Notice extends ItemWithStatus {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column()
  name!: string;

  @Column()
  text!: string;

  @Column({ type: String, nullable: true })
  buttonText!: string | null;

  @Column({ type: String, nullable: true })
  url!: string | null;
}
