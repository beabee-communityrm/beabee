import { RoleType } from "@beabee/beabee-common";
import { CreateDateColumn, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import ContactRole from "./ContactRole";

export default abstract class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @CreateDateColumn()
  joined!: Date;

  @OneToMany("ContactRole", "contact", { eager: true, cascade: true })
  roles!: ContactRole[];

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
