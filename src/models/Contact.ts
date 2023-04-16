import { ContributionType, ContributionPeriod } from "@beabee/beabee-common";
import { Column, Entity, OneToMany, OneToOne } from "typeorm";

import { getActualAmount } from "@core/utils";
import config from "@config";

import type UserRole from "./UserRole";
import type ContactProfile from "./ContactProfile";
import Password from "./Password";
import type PaymentData from "./PaymentData";
import AppUser from "./AppUser";
import ApiUser from "./ApiUser";

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
export default class Contact extends AppUser {
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

  @OneToOne("ContactProfile", "contact")
  profile!: ContactProfile;

  @OneToOne("PaymentData", "contact")
  paymentData!: PaymentData;

  @OneToMany("ApiUser", "creator")
  apiUser!: ApiUser[];

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

  get membership(): UserRole | undefined {
    return this.roles.find((p) => p.type === "member");
  }

  get setupComplete(): boolean {
    return this.password.hash !== "";
  }
}
