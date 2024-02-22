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
import { Transform, Type, plainToInstance } from "class-transformer";
import {
  Equals,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  ValidateBy,
  ValidateNested,
  ValidationOptions,
  buildMessage,
  validate
} from "class-validator";

// content

const inputTypes = [
  "address",
  "button",
  "checkbox",
  "currency",
  "datetime",
  "email",
  "file",
  "number",
  "password",
  "phoneNumber",
  "signature",
  "textfield",
  "textarea",
  "time",
  "url"
] as const;
const nestedTypes = ["panel", "well", "tabs"] as const;
const selectTypes = ["select"] as const;
const radioTypes = ["radio", "selectboxes"] as const;

abstract class BaseCalloutComponentDto implements BaseCalloutComponentSchema {
  abstract type: string;
  abstract input?: boolean;

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

class ContentCalloutComponentDto extends BaseCalloutComponentDto {
  @Equals(false)
  input!: false;

  @IsIn(["content"])
  type!: "content";
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

  @IsOptional()
  @IsString()
  nextSlideId?: string;
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
  return Transform(({ value }) => {
    if (!Array.isArray(value)) throw new Error("Components must be an array");

    return value.map((component) => {
      if (typeof component !== "object" || component === null)
        throw new Error("Component must be an object");

      switch (true) {
        case inputTypes.includes(component.type):
          return plainToInstance(InputCalloutComponentDto, component);
        case selectTypes.includes(component.type):
          return plainToInstance(SelectCalloutComponentDto, component);
        case radioTypes.includes(component.type):
          return plainToInstance(RadioCalloutComponentDto, component);
        case nestedTypes.includes(component.type):
          return plainToInstance(NestableCalloutComponentDto, component);
        case "content" === component.type:
          return plainToInstance(ContentCalloutComponentDto, component);
        default:
          throw new Error("Unknown component type " + component.type);
      }
    });
  });
}

// This is hack to disable whitelist validation for components because
// the schema for a component has loads of properties and it would take
// a long time to list them all.
// TODO: validate properly!
function IsComponent(validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: "isComponent",
      validator: {
        async validate(value: unknown) {
          if (typeof value !== "object" || value === null) return false;
          const error = await validate(value, {
            whitelist: false,
            forbidUnknownValues: true
          });
          return error.length === 0;
        },
        defaultMessage: buildMessage(
          (eachPrefix) => eachPrefix + "$property must be a valid component",
          validationOptions
        )
      }
    },
    validationOptions
  );
}

type CalloutComponentDto =
  | ContentCalloutComponentDto
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

  @IsComponent({ each: true })
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

  @IsComponent({ each: true })
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