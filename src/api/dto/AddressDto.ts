import Address from "@models/Address";
import { IsDefined, IsOptional, IsString } from "class-validator";

// Use @IsDefined() to make sure the field is present even if used within
// PartialBody
export class AddressDto implements Address {
  @IsDefined()
  @IsString()
  line1!: string;

  @IsOptional()
  @IsString()
  line2?: string;

  @IsDefined()
  @IsString()
  city!: string;

  @IsDefined()
  @IsString()
  postcode!: string;
}
