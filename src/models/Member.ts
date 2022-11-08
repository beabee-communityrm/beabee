import {
  ContributionType,
  ContributionPeriod,
  PermissionType
} from "@beabee/beabee-common";
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn
} from "typeorm";

import { getActualAmount } from "@core/utils";
import config from "@config";

import type MemberPermission from "./MemberPermission";
import type MemberProfile from "./MemberProfile";
import Password from "./Password";

interface LoginOverride {
  code: string;
  expires: Date;
}

class OneTimePassword {
  @Column({ type: String, nullable: true })
  key!: string | null;

  @Column({ default: false })
  activated!: boolean;
}

@Entity()
export default class Member {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  firstname!: string;

  @Column()
  lastname!: string;

  @Column(() => Password)
  password!: Password;

  @Column(() => OneTimePassword)
  otp!: OneTimePassword;

  @CreateDateColumn()
  joined!: Date;

  @Column({ type: Date, nullable: true })
  lastSeen!: Date | null;

  @Column({ type: "jsonb", nullable: true })
  loginOverride!: LoginOverride | null;

  @Column()
  contributionType!: ContributionType;

  @Column({ type: String, nullable: true })
  contributionPeriod!: ContributionPeriod | null;

  @Column({ type: "real", nullable: true })
  contributionMonthlyAmount!: number | null;

  @Column({ type: String, unique: true, nullable: true })
  referralCode!: string | null;

  @Column({ type: String, unique: true, nullable: true })
  pollsCode!: string | null;

  @OneToMany("MemberPermission", "member", { eager: true, cascade: true })
  permissions!: MemberPermission[];

  @OneToOne("MemberProfile", "member")
  profile!: MemberProfile;

  get activePermissions(): PermissionType[] {
    return this.permissions.filter((p) => p.isActive).map((p) => p.permission);
  }

  // Alias to match GetMemberData with Member for membersTableBasicInfo
  // TODO: Remove once legacy app is gone
  get activeRoles(): PermissionType[] {
    return this.activePermissions;
  }

  hasPermission(permission: PermissionType): boolean {
    return (
      this.activePermissions.includes("superadmin") ||
      this.activePermissions.includes(permission)
    );
  }

  get fullname(): string {
    return this.firstname || this.lastname
      ? this.firstname + " " + this.lastname
      : "";
  }

  get contributionAmount(): number | null {
    return this.contributionMonthlyAmount === null
      ? null
      : getActualAmount(
          this.contributionMonthlyAmount,
          this.contributionPeriod!
        );
  }

  get contributionDescription(): string {
    if (this.contributionType === "Gift") {
      return "Gift";
    } else if (
      this.contributionType === "None" ||
      !this.contributionPeriod ||
      !this.contributionMonthlyAmount
    ) {
      return "None";
    } else {
      return `${config.currencySymbol}${this.contributionAmount}/${
        this.contributionPeriod === "monthly" ? "month" : "year"
      }`;
    }
  }

  get membership(): MemberPermission | undefined {
    return this.permissions.find((p) => p.permission === "member");
  }

  get setupComplete(): boolean {
    return this.password.hash !== "";
  }
}
