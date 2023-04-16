import { RoleType } from "@beabee/beabee-common";
import {
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn
} from "typeorm";
import UserRole from "./UserRole";

@Entity()
export default abstract class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @CreateDateColumn()
  joined!: Date;

  @OneToMany("UserRole", "user", { eager: true, cascade: true })
  roles!: UserRole[];

  get activeRoles(): RoleType[] {
    return this.roles.filter((p) => p.isActive).map((p) => p.type);
  }

  hasRole(roleType: RoleType): boolean {
    return (
      this.activeRoles.includes("superadmin") ||
      this.activeRoles.includes(roleType)
    );
  }
}
