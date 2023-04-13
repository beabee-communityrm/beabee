import ApiUsersService from "@core/services/ApiUsersService";
import { generateApiKey } from "@core/utils/auth";
import Contact from "@models/Contact";
import {
  JsonController,
  Authorized,
  Post,
  CurrentUser
} from "routing-controllers";

@JsonController("/apiuser")
@Authorized()
export class ApiUserController {
  @Post("/")
  async createApiUser(
    @CurrentUser({ required: true }) creator: Contact
  ): Promise<string> {
    const { id, secret, secretHash, token } = generateApiKey();
    const apiKey = { id: id, secretHash: secretHash };
    const apiUser = await ApiUsersService.createApiUser({
      roles: [],
      apikey: apiKey,
      creator: creator
    });

    return token;
  }
}
