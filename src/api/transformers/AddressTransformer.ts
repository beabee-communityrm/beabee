import { TransformPlainToInstance } from "class-transformer";

import { GetAddressDto } from "@api/dto/AddressDto";
import { Address } from "@type/address";

// TODO: make Address into a proper model
class AddressTransformer {
  @TransformPlainToInstance(GetAddressDto)
  convert(address: Address): GetAddressDto {
    return {
      line1: address.line1,
      line2: address.line2 || "",
      city: address.city,
      postcode: address.postcode
    };
  }
}

export default new AddressTransformer();
