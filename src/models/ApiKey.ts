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

  @ManyToOne("Contact")
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
