import type { ContactData } from "@type/contact-data";
import type { ContributionInfo } from "@core/utils";
import type { ContributionPeriod, RoleType } from "@beabee/beabee-common";
import type { ContactProfileData } from "@type/contact-profile-data";
import type { GetContactRoleData } from "@type/get-contact-role-data";

export interface GetContactData extends ContactData {
  id: string;
  joined: Date;
  lastSeen?: Date;
  contributionAmount?: number;
  contributionPeriod?: ContributionPeriod;
  activeRoles: RoleType[];
  profile?: ContactProfileData;
  roles?: GetContactRoleData[];
  contribution?: ContributionInfo;
}
