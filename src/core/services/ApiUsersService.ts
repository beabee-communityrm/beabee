import { log as mainLogger } from "@core/logging";
import ApiUser from "@models/ApiUser";
import { getRepository } from "typeorm";

const log = mainLogger.child({ app: "contacts-service" });

class ApiUsersService {
  async createApiUser(
    partialApiUser: Partial<ApiUser> &
      Pick<ApiUser, "roles" | "apiKey" | "creator">
  ): Promise<ApiUser> {
    log.info("Create ApiUser");

    const apiUser = getRepository(ApiUser).create(partialApiUser);
    return await getRepository(ApiUser).save(apiUser);
  }
}

export default new ApiUsersService();
