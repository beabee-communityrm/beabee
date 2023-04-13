import { log as mainLogger } from "@core/logging";
import ApiUser from "@models/ApiUser";
import { getRepository } from "typeorm";

export type PartialApiUser = Pick<ApiUser, "apikey"> & Partial<ApiUser>;

const log = mainLogger.child({ app: "contacts-service" });

class ApiUsersService {
  async createApiUser(
    PartialApiUser: Partial<ApiUser> &
      Pick<ApiUser, "roles" | "apikey" | "creator">
  ): Promise<ApiUser> {
    log.info("Create ApiUser");

    const apiUser = getRepository(ApiUser).create({
      ...PartialApiUser
    });
    await getRepository(ApiUser).save(apiUser);
    return apiUser;
  }
}

export default new ApiUsersService();
