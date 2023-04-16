import { RoleType } from "@beabee/beabee-common";
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn
} from "typeorm";
import type User from "./User";

@Entity()
export default class UserRole {
  @ManyToOne("User", "roles", { primary: true })
  user!: User;

  @PrimaryColumn()
  type!: RoleType;

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
