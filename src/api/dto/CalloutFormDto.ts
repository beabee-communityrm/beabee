import {
  CalloutFormSchema,
  CalloutNavigationSchema,
  CalloutSlideSchema,
  CalloutComponentBaseSchema,
  CalloutComponentBaseInputSchema,
  CalloutComponentBaseNestableSchema,
  CalloutComponentContentSchema,
  CalloutComponentInputSelectSchema,
  CalloutComponentType,
  calloutComponentNestableTypes,
  calloutComponentInputTypes,
  CalloutComponentBaseInputSelectableSchema,
  calloutComponentInputSelectableTypes,
  CalloutComponentSchema
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

abstract class CalloutComponentBaseDto implements CalloutComponentBaseSchema {
  abstract type: CalloutComponentType;
  abstract input?: boolean;

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

  // Unused properties
  [key: string]: unknown;
}

class CalloutComponentContentDto
  extends CalloutComponentBaseDto
  implements CalloutComponentContentSchema
{
  @Equals(false)
  input!: false;

  @Equals(CalloutComponentType.CONTENT)
  type!: CalloutComponentType.CONTENT;
}

class CalloutComponentInputDto
  extends CalloutComponentBaseDto
  implements CalloutComponentBaseInputSchema
{
  @IsIn(calloutComponentInputTypes)
  type!: CalloutComponentBaseInputSchema["type"];

  @Equals(true)
  input!: true;
}

class CalloutComponentInputSelectDataValueDto {
  @IsString()
  label!: string;

  @IsString()
  value!: string;
}

class CalloutComponentInputSelectDataDto {
  @ValidateNested({ each: true })
  @Type(() => CalloutComponentInputSelectDataValueDto)
  values!: CalloutComponentInputSelectDataValueDto[];

  // Unused properties
  [key: string]: unknown;
}

class CalloutComponentInputSelectDto
  extends CalloutComponentInputDto
  implements CalloutComponentInputSelectSchema
{
  @Equals(CalloutComponentType.INPUT_SELECT)
  type!: CalloutComponentType.INPUT_SELECT;

  @ValidateNested()
  @Type(() => CalloutComponentInputSelectDataDto)
  data!: CalloutComponentInputSelectDataDto;
}

class CalloutComponentInputSelectableValueDto {
  @IsString()
  label!: string;

  @IsString()
  value!: string;

  @IsOptional()
  @IsString()
  nextSlideId?: string;
}

class CalloutComponentInputSelectableDto
  extends CalloutComponentInputDto
  implements CalloutComponentBaseInputSelectableSchema
{
  @Equals(calloutComponentInputSelectableTypes)
  type!: CalloutComponentBaseInputSelectableSchema["type"];

  @ValidateNested({ each: true })
  @Type(() => CalloutComponentInputSelectableValueDto)
  values!: CalloutComponentInputSelectableValueDto[];
}

function ComponentType() {
  return Transform(({ value }) => {
    if (!Array.isArray(value)) throw new Error("Components must be an array");

    return value.map((component) => {
      if (typeof component !== "object" || component === null)
        throw new Error("Component must be an object");

      switch (component.type) {
        case CalloutComponentType.CONTENT:
          return plainToInstance(CalloutComponentContentDto, component);
        case CalloutComponentType.INPUT_SELECT:
          return plainToInstance(CalloutComponentInputSelectDto, component);
      }

      if (calloutComponentInputSelectableTypes.includes(component.type)) {
        return plainToInstance(CalloutComponentInputSelectableDto, component);
      }
      if (calloutComponentInputTypes.includes(component.type)) {
        return plainToInstance(CalloutComponentInputDto, component);
      }
      if (calloutComponentNestableTypes.includes(component.type)) {
        return plainToInstance(CalloutComponentNestableDto, component);
      }

      throw new Error("Unknown component type " + component.type);
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

class CalloutComponentNestableDto
  extends CalloutComponentBaseDto
  implements CalloutComponentBaseNestableSchema
{
  @IsIn(calloutComponentNestableTypes)
  type!: CalloutComponentBaseNestableSchema["type"];

  @Equals(false)
  input!: false;

  @IsComponent({ each: true })
  @ComponentType()
  components!: CalloutComponentSchema[];
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
  components!: CalloutComponentSchema[];

  @ValidateNested()
  @Type(() => CalloutNavigationDto)
  navigation!: CalloutNavigationSchema;
}

export class CalloutFormDto implements CalloutFormSchema {
  @ValidateNested({ each: true })
  @Type(() => CalloutSlideDto)
  slides!: CalloutSlideDto[];
}
