import ApiUsersService from "@core/services/ApiUsersService";
import UsersService from "@core/services/UsersService";
import { generateApiKey } from "@core/utils/auth";
import Contact from "@models/Contact";
import {
  JsonController,
  Authorized,
  Post,
  CurrentUser
} from "routing-controllers";

@JsonController("/api-user")
@Authorized()
export class ApiUserController {
  @Post("/")
  async createApiUser(
    @CurrentUser({ required: true }) creator: Contact
  ): Promise<{ token: string }> {
    const { id, secret, secretHash, token } = generateApiKey();
    const apiKey = { id: id, secretHash: secretHash };
    const apiUser = await ApiUsersService.createApiUser({
      roles: [],
      apiKey: apiKey,
      creator: creator
    });

    await UsersService.updateUserRole(apiUser, "admin");

    return { token };
  }
}
