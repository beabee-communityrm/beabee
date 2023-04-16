import { RoleType } from "@beabee/beabee-common";
import { log as mainLogger } from "@core/logging";
import User from "@models/User";
import UserRole from "@models/UserRole";
import { FindConditions, FindOneOptions, getRepository } from "typeorm";
import NewsletterService from "./NewsletterService";
import OptionsService from "./OptionsService";
import ContactsService from "./ContactsService";
import Contact from "@models/Contact";

const log = mainLogger.child({ app: "users-service" });

class UsersService {
  async findOne(
    id?: string,
    options?: FindOneOptions<User>
  ): Promise<User | undefined>;
  async findOne(options?: FindOneOptions<User>): Promise<User | undefined>;
  async findOne(
    conditions: FindConditions<User>,
    options?: FindOneOptions<User>
  ): Promise<User | undefined>;
  async findOne(
    arg1?: string | FindConditions<User> | FindOneOptions<User>,
    arg2?: FindOneOptions<User>
  ): Promise<User | undefined> {
    return await getRepository(User).findOne(arg1 as any, arg2);
  }

  async updateUserRole(
    user: User,
    roleType: RoleType,
    updates?: Partial<Omit<UserRole, "user" | "type">>
  ): Promise<void> {
    log.info(`Update role ${roleType} for ${user.id}`, updates);

    const existingRole = user.roles.find((p) => p.type === roleType);
    if (existingRole && updates) {
      Object.assign(existingRole, updates);
    } else {
      const newRole = getRepository(UserRole).create({
        user: user,
        type: roleType,
        ...updates
      });
      user.roles.push(newRole);
    }
    await getRepository(User).save(user);
    if (user instanceof Contact) {
      ContactsService.updateContactMembership(user);
    }
  }

  async extendUserRole(
    user: User,
    roleType: RoleType,
    dateExpires: Date
  ): Promise<void> {
    const p = user.roles.find((p) => p.type === roleType);
    log.info(`Extend role ${roleType} for ${user.id}`, {
      userId: user.id,
      role: roleType,
      prevDate: p?.dateExpires,
      newDate: dateExpires
    });
    if (!p?.dateExpires || dateExpires > p.dateExpires) {
      await this.updateUserRole(user, roleType, { dateExpires });
    }
  }

  async revokeUserRole(user: User, roleType: RoleType): Promise<void> {
    log.info(`Revoke role ${roleType} for ${user.id}`);
    user.roles = user.roles.filter((p) => p.type !== roleType);
    await getRepository(UserRole).delete({
      user: user,
      type: roleType
    });

    if (user instanceof Contact && !user.membership?.isActive) {
      await NewsletterService.removeTagFromContacts(
        [user],
        OptionsService.getText("newsletter-active-member-tag")
      );
    }
  }
}

export default new UsersService();
