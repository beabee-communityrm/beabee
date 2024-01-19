import { AddressDto } from "@api/dto/AddressDto";

import Address from "@models/Address";
import { TransformPlainToInstance } from "class-transformer";

// TODO: make Address into a proper model
class AddressTransformer {
  @TransformPlainToInstance(AddressDto)
  convert(address: Address): AddressDto {
    return {
      line1: address.line1,
      line2: address.line2 || "",
      city: address.city,
      postcode: address.postcode
    };
  }
}

export default new AddressTransformer();
