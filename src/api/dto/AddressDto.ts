import Address from "@models/Address";
import { IsDefined, IsString } from "class-validator";

export class UpdateAddressDto implements Address {
  @IsDefined()
  @IsString()
  line1!: string;

  @IsString()
  line2?: string;

  @IsDefined()
  @IsString()
  city!: string;

  @IsDefined()
  @IsString()
  postcode!: string;
}

export interface GetAddressDto extends UpdateAddressDto {}
