import "module-alias/register";

import { defaultMetadataStorage } from "class-transformer/cjs/storage";
import { validationMetadatasToSchemas } from "class-validator-jsonschema";
import { getMetadataArgsStorage } from "routing-controllers";
import { routingControllersToSpec } from "routing-controllers-openapi";

import "@api/controllers";

import "@api/dto/AddressDto";
import "@api/dto/ApiKeyDto";
import "@api/dto/BaseDto";
import "@api/dto/CalloutDto";
import "@api/dto/CalloutResponseCommentDto";
import "@api/dto/CalloutResponseDto";
import "@api/dto/CalloutTagDto";
import "@api/dto/ContactDto";
import "@api/dto/ContactMfaDto";
import "@api/dto/ContactProfileDto";
import "@api/dto/ContactRoleDto";
import "@api/dto/ContentDto";
import "@api/dto/ContributionDto";
import "@api/dto/EmailDto";
import "@api/dto/JoinFlowDto";
import "@api/dto/LinkDto";
import "@api/dto/LoginDto";
import "@api/dto/NoticeDto";
// import "@api/dto/PaginatedDto";
import "@api/dto/PaymentDto";
import "@api/dto/PaymentFlowDto";
import "@api/dto/ResetDeviceDto";
import "@api/dto/ResetPasswordDto";
import "@api/dto/SegmentDto";
import "@api/dto/SignupFlowDto";
import "@api/dto/StatsDto";
import "@api/dto/UploadFlowDto";
import { ValidationTypes } from "class-validator";

const schemas = validationMetadatasToSchemas({
  additionalConverters: {
    [ValidationTypes.IS_DEFINED]: () => ({})
  },
  refPointerPrefix: "#/components/schemas/",
  classTransformerMetadataStorage: defaultMetadataStorage
});

const storage = getMetadataArgsStorage();
const spec = routingControllersToSpec(
  storage,
  { routePrefix: "/api/1.0" },
  { components: { schemas } }
);

console.log(JSON.stringify(spec));
