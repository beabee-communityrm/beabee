import {
  BaseCalloutComponentSchema,
  CalloutFormSchema,
  CalloutNavigationSchema,
  CalloutSlideSchema,
  InputCalloutComponentSchema,
  NestableCalloutComponentSchema,
  RadioCalloutComponentSchema,
  SelectCalloutComponentSchema
} from "@beabee/beabee-common";
import { Type } from "class-transformer";
import {
  Equals,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested
} from "class-validator";

const inputTypes = [
  "number",
  "address",
  "button",
  "checkbox",
  "email",
  "file",
  "password",
  "textfield",
  "textarea"
] as const;
const nestedTypes = ["panel", "well", "tabs"] as const;
const selectTypes = ["select"] as const;
const radioTypes = ["radio", "selectboxes"] as const;

abstract class BaseCalloutComponentDto implements BaseCalloutComponentSchema {
  abstract type: string;
  abstract input?: boolean;

  // TODO
  [key: string]: unknown;

  @IsString()
  id!: string;

  @IsString()
  key!: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  adminOnly?: boolean;
}

class InputCalloutComponentDto
  extends BaseCalloutComponentDto
  implements InputCalloutComponentSchema
{
  @IsIn(inputTypes)
  type!: (typeof inputTypes)[number];

  @Equals(true)
  input!: true;
}

class SelectCalloutComponentValueDto {
  @IsString()
  label!: string;

  @IsString()
  value!: string;
}

class SelectCalloutComponentDataDto {
  @ValidateNested({ each: true })
  @Type(() => SelectCalloutComponentValueDto)
  values!: SelectCalloutComponentValueDto[];
}

class SelectCalloutComponentDto
  extends BaseCalloutComponentDto
  implements SelectCalloutComponentSchema
{
  @IsIn(selectTypes)
  type!: (typeof selectTypes)[number];

  @Equals(true)
  input!: true;

  @ValidateNested()
  @Type(() => SelectCalloutComponentDataDto)
  data!: SelectCalloutComponentDataDto;
}

class RadioCalloutComponentValueDto {
  @IsString()
  label!: string;

  @IsString()
  value!: string;

  @IsString()
  nextSlideId!: string;
}

class RadioCalloutComponentDto
  extends BaseCalloutComponentDto
  implements RadioCalloutComponentSchema
{
  @IsIn(radioTypes)
  type!: (typeof radioTypes)[number];

  @Equals(true)
  input!: true;

  @ValidateNested({ each: true })
  @Type(() => RadioCalloutComponentValueDto)
  values!: RadioCalloutComponentValueDto[];
}

function ComponentType() {
  return Type(() => BaseCalloutComponentDto, {
    discriminator: {
      property: "type",
      subTypes: [
        ...nestedTypes.map((type) => ({
          value: NestableCalloutComponentDto,
          name: type
        })),
        ...inputTypes.map((type) => ({
          value: InputCalloutComponentDto,
          name: type
        })),
        ...selectTypes.map((type) => ({
          value: SelectCalloutComponentDto,
          name: type
        })),
        ...radioTypes.map((type) => ({
          value: RadioCalloutComponentDto,
          name: type
        }))
      ]
    }
  });
}

type CalloutComponentDto =
  | NestableCalloutComponentDto
  | InputCalloutComponentDto
  | SelectCalloutComponentDto
  | RadioCalloutComponentDto;

class NestableCalloutComponentDto
  extends BaseCalloutComponentDto
  implements NestableCalloutComponentSchema
{
  @IsIn(nestedTypes)
  type!: (typeof nestedTypes)[number];

  @Equals(false)
  input!: false;

  @ValidateNested({ each: true })
  @ComponentType()
  components!: CalloutComponentDto[];
}

class CalloutNavigationDto implements CalloutNavigationSchema {
  @IsString()
  prevText!: string;

  @IsString()
  nextText!: string;

  @IsString()
  nextSlideId!: string;

  @IsString()
  submitText!: string;
}

class CalloutSlideDto implements CalloutSlideSchema {
  @IsString()
  id!: string;

  @IsString()
  title!: string;

  @ValidateNested({ each: true })
  @ComponentType()
  components!: CalloutComponentDto[];

  @ValidateNested()
  @Type(() => CalloutNavigationDto)
  navigation!: CalloutNavigationSchema;
}

export class CalloutFormDto implements CalloutFormSchema {
  @ValidateNested({ each: true })
  @Type(() => CalloutSlideDto)
  slides!: CalloutSlideDto[];
}
