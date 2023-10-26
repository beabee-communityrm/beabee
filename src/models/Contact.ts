import {
  ContributionType,
  ContributionPeriod,
  RoleType
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

import type ContactRole from "./ContactRole";
import type ContactProfile from "./ContactProfile";
import Password from "./Password";
import type PaymentData from "./PaymentData";

interface LoginOverride {
  code: string;
  expires: Date;
}

@Entity()
export default class Contact {
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

  @OneToMany("ContactRole", "contact", { eager: true, cascade: true })
  roles!: ContactRole[];

  @OneToOne("ContactProfile", "contact")
  profile!: ContactProfile;

  @OneToOne("PaymentData", "contact")
  paymentData!: PaymentData;

  get activeRoles(): RoleType[] {
    return this.roles.filter((p) => p.isActive).map((p) => p.type);
  }

  hasRole(roleType: RoleType): boolean {
    return (
      this.activeRoles.includes("superadmin") ||
      this.activeRoles.includes(roleType)
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

  get membership(): ContactRole | undefined {
    return this.roles.find((p) => p.type === "member");
  }

  get setupComplete(): boolean {
    return this.password.hash !== "";
  }
}
