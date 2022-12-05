import { PermissionType } from "@beabee/beabee-common";
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn
} from "typeorm";
import type Contact from "./Contact";

@Entity()
export default class ContactRole {
  @ManyToOne("Contact", "roles", { primary: true })
  contact!: Contact;

  @PrimaryColumn()
  type!: PermissionType;

  @CreateDateColumn()
  dateAdded!: Date;

  @Column({ type: Date, nullable: true })
  dateExpires!: Date | null;

  get isActive(): boolean {
    const now = new Date();
    return (
      this.dateAdded <= now && (!this.dateExpires || this.dateExpires >= now)
    );
  }
}
