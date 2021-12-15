import moment from "moment";
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn
} from "typeorm";

import {
  ContributionPeriod,
  ContributionType,
  getActualAmount
} from "@core/utils";
import config from "@config";

import type MemberPermission from "./MemberPermission";
import type { PermissionType } from "./MemberPermission";
import type MemberProfile from "./MemberProfile";
import Password from "./Password";

interface LoginOverride {
  code: string;
  expires: Date;
}

class OneTimePassword {
  @Column({ nullable: true })
  key?: string;

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

  @Column({ nullable: true })
  lastSeen?: Date;

  @Column({ type: "jsonb", nullable: true })
  loginOverride?: LoginOverride;

  @Column()
  contributionType!: ContributionType;

  @Column({ nullable: true })
  contributionPeriod?: ContributionPeriod;

  @Column({ type: "real", nullable: true })
  contributionMonthlyAmount?: number;

  @Column({ type: "real", nullable: true })
  nextContributionMonthlyAmount?: number;

  @Column({ unique: true, nullable: true })
  referralCode?: string;

  @Column({ unique: true, nullable: true })
  pollsCode?: string;

  @OneToMany("MemberPermission", "member", { eager: true, cascade: true })
  permissions!: MemberPermission[];

  @OneToOne("MemberProfile", "member")
  profile!: MemberProfile;

  get quickPermissions(): PermissionType[] {
    return this.permissions.filter((p) => p.isActive).map((p) => p.permission);
  }

  hasPermission(permission: PermissionType): boolean {
    return (
      this.quickPermissions.indexOf("superadmin") > -1 ||
      this.quickPermissions.indexOf(permission) > -1
    );
  }

  get fullname(): string {
    return this.firstname || this.lastname
      ? this.firstname + " " + this.lastname
      : "";
  }

  get contributionAmount(): number | undefined {
    return this.contributionMonthlyAmount === undefined
      ? undefined
      : this.contributionMonthlyAmount *
          (this.contributionPeriod === ContributionPeriod.Monthly ? 1 : 12);
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
      const amount = getActualAmount(
        this.contributionMonthlyAmount,
        this.contributionPeriod
      );
      return `${config.currencySymbol}${amount}/${
        this.contributionPeriod === "monthly" ? "month" : "year"
      }`;
    }
  }

  get membership(): MemberPermission | undefined {
    return this.permissions.find((p) => p.permission === "member");
  }

  get memberMonthsRemaining(): number {
    return this.membership
      ? Math.max(
          0,
          moment
            .utc(this.membership.dateExpires)
            .subtract(config.gracePeriod)
            .diff(moment.utc(), "months")
        )
      : 0;
  }

  get setupComplete(): boolean {
    return this.password.hash !== "";
  }
}
