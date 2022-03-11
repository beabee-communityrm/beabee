import "module-alias/register";
import "reflect-metadata";

import { getMetadataArgsStorage } from "routing-controllers";
import { routingControllersToSpec } from "routing-controllers-openapi";
import { validationMetadatasToSchemas } from "class-validator-jsonschema";

import "@api/controllers/AuthController";
import "@api/controllers/CalloutController";
import "@api/controllers/ContentController";
import "@api/controllers/MemberController";
import "@api/controllers/NoticeController";
import "@api/controllers/SegmentController";
import "@api/controllers/SignupController";
import "@api/controllers/ResetPasswordController";

const storage = getMetadataArgsStorage();
const schemas = validationMetadatasToSchemas({
  refPointerPrefix: "#/components/schemas"
});
const spec = routingControllersToSpec(
  storage,
  {
    validation: {
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      whitelist: true,
      validationError: {
        target: false,
        value: false
      }
    },
    defaults: {
      paramOptions: {
        required: true
      }
    }
  },
  {
    components: { schemas }
  }
);
console.log(JSON.stringify(spec, null, 2));
