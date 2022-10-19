import { PermissionType } from "@beabee/beabee-common";
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn
} from "typeorm";
import type Member from "./Member";

@Entity()
export default class MemberPermission {
  @ManyToOne("Member", "permissions", { primary: true })
  member!: Member;

  @PrimaryColumn()
  permission!: PermissionType;

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
