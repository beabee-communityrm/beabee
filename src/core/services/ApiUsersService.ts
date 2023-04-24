import { log as mainLogger } from "@core/logging";
import ApiUser from "@models/ApiUser";
import { getRepository } from "typeorm";

const log = mainLogger.child({ app: "ApiUsers-service" });

class ApiUsersService {
  async createApiUser(
    partialApiUser: Partial<ApiUser> &
      Pick<ApiUser, "roles" | "apiKey" | "creator">
  ): Promise<ApiUser> {
    log.info("Create ApiUser");

    const apiUser = getRepository(ApiUser).create(partialApiUser);
    return await getRepository(ApiUser).save(apiUser);
  }

  async findOne(secretHash: string): Promise<ApiUser | undefined> {
    return await getRepository(ApiUser).findOne({
      where: { apiKey: { secretHash: secretHash } }
    });
  }
}

export default new ApiUsersService();
