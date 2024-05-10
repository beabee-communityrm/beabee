import { RoleType } from "@beabee/beabee-common";
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn
} from "typeorm";

import type Contact from "./Contact";

@Entity()
export default class ApiKey {
  @PrimaryColumn()
  id!: string;

  @Column({ type: String, nullable: true })
  creatorId!: string | null;
  @ManyToOne("Contact", { nullable: true })
  creator!: Contact;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: Date, nullable: true })
  expires!: Date | null;

  @Column()
  secretHash!: string;

  @Column()
  description!: string;

  get activeRoles(): RoleType[] {
    return ["admin"];
  }
}
