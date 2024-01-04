import { ContributionPeriod, NewsletterStatus } from "@beabee/beabee-common";
import { Request, Response } from "express";
import {
  Authorized,
  BadRequestError,
  Body,
  createParamDecorator,
  CurrentUser,
  Delete,
  Get,
  JsonController,
  NotFoundError,
  OnUndefined,
  Params,
  Patch,
  Post,
  Put,
  QueryParams,
  Res
} from "routing-controllers";

import { PaymentFlowParams } from "@core/providers/payment-flow";

import AuthService from "@core/services/AuthService";
import ContactsService from "@core/services/ContactsService";
import OptionsService from "@core/services/OptionsService";
import PaymentFlowService from "@core/services/PaymentFlowService";
import PaymentService from "@core/services/PaymentService";
import ContactMfaService from "@core/services/ContactMfaService";

import { generatePassword } from "@core/utils/auth";

import Contact from "@models/Contact";
import JoinFlow from "@models/JoinFlow";

import { GetExportQuery } from "@api/dto/BaseDto";
import {
  CreateContactDto,
  GetContactDto,
  GetContactOptsDto,
  ListContactsDto,
  UpdateContactDto
} from "@api/dto/ContactDto";
import {
  CreateContactMfaDto,
  DeleteContactMfaDto,
  GetContactMfaDto
} from "@api/dto/ContactMfaDto";
import {
  GetContactRoleDto,
  UpdateContactRoleDto
} from "@api/dto/ContactRoleDto";
import {
  StartContributionDto,
  ForceUpdateContributionDto,
  UpdateContributionDto
} from "@api/dto/ContributionDto";
import { CompleteJoinFlowDto, StartJoinFlowDto } from "@api/dto/JoinFlowDto";
import { PaginatedDto } from "@api/dto/PaginatedDto";
import { GetPaymentDto, ListPaymentsDto } from "@api/dto/PaymentDto";

import PartialBody from "@api/decorators/PartialBody";
import { UnauthorizedError } from "@api/errors/UnauthorizedError";
import CantUpdateContribution from "@api/errors/CantUpdateContribution";
import NoPaymentMethod from "@api/errors/NoPaymentMethod";
import { ContactRoleParams } from "@api/params/ContactRoleParams";
import { UUIDParams } from "@api/params/UUIDParams";
import { validateOrReject } from "@api/utils";

import ContactExporter from "@api/transformers/ContactExporter";
import ContactTransformer from "@api/transformers/ContactTransformer";
import ContactRoleTransformer from "@api/transformers/ContactRoleTransformer";
import PaymentTransformer from "@api/transformers/PaymentTransformer";

import { GetContactWith } from "@enums/get-contact-with";

import { ContributionInfo } from "@type/contribution-info";
import { mergeRules } from "@api/utils/rules";

/**
 * The target user can either be the current user or for admins
 * it can be any user, this decorator injects the correct target
 * and also ensures the user has the correct roles
 */
function TargetUser() {
  return createParamDecorator({
    required: true,
    value: async (action): Promise<Contact> => {
      const request: Request = action.request;

      const auth = await AuthService.check(request);
      if (!auth) {
        throw new UnauthorizedError();
      }

      const id = request.params.id;
      if (auth === true || (id !== "me" && auth.hasRole("admin"))) {
        const uuid = new UUIDParams();
        uuid.id = id;
        await validateOrReject(uuid);

        const target = await ContactsService.findOneBy({ id });
        if (target) {
          return target;
        } else {
          throw new NotFoundError();
        }
      } else if (id === "me" || id === auth.id) {
        return auth;
      } else {
        throw new UnauthorizedError();
      }
    }
  });
}

@JsonController("/contact")
@Authorized()
export class ContactController {
  @Authorized("admin")
  @Post("/")
  async createContact(
    @CurrentUser() caller: Contact,
    @Body() data: CreateContactDto
  ) {
    const contact = await ContactsService.createContact(
      {
        email: data.email,
        firstname: data.firstname,
        lastname: data.lastname,
        ...(data.password && {
          password: await generatePassword(data.password)
        })
      },
      data.profile && {
        ...data.profile,
        ...(data.profile.newsletterStatus === NewsletterStatus.Subscribed && {
          // Automatically add default groups for now, this should be revisited
          // once groups are exposed to the frontend
          newsletterGroups: OptionsService.getList("newsletter-default-groups")
        })
      }
    );

    if (data.roles) {
      for (const role of data.roles) {
        await ContactsService.updateContactRole(contact, role.role, role);
      }
    }

    if (data.contribution) {
      await ContactsService.forceUpdateContactContribution(
        contact,
        data.contribution
      );
    }

    return ContactTransformer.convert(
      contact,
      {
        with: [
          ...(data.profile ? [GetContactWith.Profile] : []),
          ...(data.roles ? [GetContactWith.Roles] : [])
        ]
      },
      caller
    );
  }

  @Authorized("admin")
  @Get("/")
  async getContacts(
    @CurrentUser() caller: Contact,
    @QueryParams() query: ListContactsDto
  ): Promise<PaginatedDto<GetContactDto>> {
    return await ContactTransformer.fetch(caller, query);
  }

  @Authorized("admin")
  @Get(".csv")
  async exportContacts(
    @CurrentUser() caller: Contact,
    @QueryParams() query: GetExportQuery,
    @Res() res: Response
  ): Promise<Response> {
    const [exportName, exportData] = await ContactExporter.export(
      caller,
      query
    );
    res.attachment(exportName).send(exportData);
    return res;
  }

  @Get("/:id")
  async getContact(
    @CurrentUser() caller: Contact,
    @TargetUser() target: Contact,
    @QueryParams() query: GetContactOptsDto
  ): Promise<GetContactDto | undefined> {
    return await ContactTransformer.fetchOneById(caller, target.id, query);
  }

  @Patch("/:id")
  async updateContact(
    @CurrentUser() caller: Contact,
    @TargetUser() target: Contact,
    @PartialBody() data: UpdateContactDto // Should be Partial<UpdateContactData>
  ): Promise<GetContactDto | undefined> {
    if (data.email || data.firstname || data.lastname || data.password) {
      await ContactsService.updateContact(target, {
        ...(data.email && { email: data.email }),
        ...(data.firstname !== undefined && { firstname: data.firstname }),
        ...(data.lastname !== undefined && { lastname: data.lastname }),
        ...(data.password && {
          password: await generatePassword(data.password)
        })
      });
    }

    if (data.profile) {
      if (
        !caller.hasRole("admin") &&
        (data.profile.tags || data.profile.notes || data.profile.description)
      ) {
        throw new UnauthorizedError();
      }

      await ContactsService.updateContactProfile(target, data.profile);
    }

    return await ContactTransformer.fetchOneById(caller, target.id, {
      with: data.profile ? [GetContactWith.Profile] : []
    });
  }

  @Get("/:id/contribution")
  async getContribution(
    @TargetUser() target: Contact
  ): Promise<ContributionInfo> {
    return await PaymentService.getContributionInfo(target);
  }

  @Patch("/:id/contribution")
  async updateContribution(
    @TargetUser() target: Contact,
    @Body() data: UpdateContributionDto
  ): Promise<ContributionInfo> {
    if (!(await PaymentService.canChangeContribution(target, true, data))) {
      throw new CantUpdateContribution();
    }

    await ContactsService.updateContactContribution(target, data);

    return await this.getContribution(target);
  }

  @Post("/:id/contribution")
  async startContribution(
    @TargetUser() target: Contact,
    @Body() data: StartContributionDto
  ): Promise<PaymentFlowParams> {
    return await this.handleStartUpdatePaymentMethod(target, data);
  }

  /**
   * Get contact multi factor authentication if exists
   * @param target The target contact
   */
  @Get("/:id/mfa")
  async getContactMfa(
    @TargetUser() target: Contact
  ): Promise<GetContactMfaDto | null> {
    const mfa = await ContactMfaService.get(target);
    return mfa || null;
  }

  /**
   * Create contact multi factor authentication
   * @param target The target contact
   * @param data The data to create the contact multi factor authentication
   */
  @OnUndefined(201)
  @Post("/:id/mfa")
  async createContactMfa(
    @Body() data: CreateContactMfaDto,
    @TargetUser() target: Contact
  ): Promise<void> {
    await ContactMfaService.create(target, data);
  }

  /**
   * Delete contact multi factor authentication
   * @param target The target contact
   * @param data The data to delete the contact multi factor authentication
   * @param id The contact id
   */
  @OnUndefined(201)
  @Delete("/:id/mfa")
  async deleteContactMfa(
    @TargetUser() target: Contact,
    @Body() data: DeleteContactMfaDto,
    @Params() { id }: { id: string }
  ): Promise<void> {
    if (id === "me") {
      await ContactMfaService.deleteSecure(target, data);
    } else {
      // It's secure to call this unsecure method here because the user is an admin,
      // this is checked in the `@TargetUser()` decorator
      await ContactMfaService.deleteUnsecure(target);
    }
  }

  @OnUndefined(204)
  @Post("/:id/contribution/cancel")
  async cancelContribution(@TargetUser() target: Contact): Promise<void> {
    await ContactsService.cancelContactContribution(
      target,
      "cancelled-contribution-no-survey"
    );
  }

  @Post("/:id/contribution/complete")
  async completeStartContribution(
    @TargetUser() target: Contact,
    @Body() data: CompleteJoinFlowDto
  ): Promise<ContributionInfo> {
    const joinFlow = await this.handleCompleteUpdatePaymentMethod(target, data);
    await ContactsService.updateContactContribution(target, joinFlow.joinForm);
    return await this.getContribution(target);
  }

  /**
   * TODO: Remove this!
   * @deprecated This is a temporary API endpoint until we rework the contribution/payment tables
   * @param target
   * @param data
   * @returns
   */
  @Authorized("admin")
  @Patch("/:id/contribution/force")
  async forceUpdateContribution(
    @TargetUser() target: Contact,
    @Body() data: ForceUpdateContributionDto
  ): Promise<ContributionInfo> {
    await ContactsService.forceUpdateContactContribution(target, data);
    return await this.getContribution(target);
  }

  @Get("/:id/payment")
  async getPayments(
    @CurrentUser() caller: Contact,
    @TargetUser() target: Contact,
    @QueryParams() query: ListPaymentsDto
  ): Promise<PaginatedDto<GetPaymentDto>> {
    return PaymentTransformer.fetch(caller, {
      ...query,
      rules: mergeRules([
        query.rules,
        { field: "contact", operator: "equal", value: [target.id] }
      ])
    });
  }

  @Put("/:id/payment-method")
  async updatePaymentMethod(
    @TargetUser() target: Contact,
    @Body() data: StartJoinFlowDto
  ): Promise<PaymentFlowParams> {
    const paymentMethod =
      data.paymentMethod || (await PaymentService.getData(target)).method;
    if (!paymentMethod) {
      throw new NoPaymentMethod();
    }

    return await this.handleStartUpdatePaymentMethod(target, {
      ...data,
      paymentMethod,
      // TODO: not needed, should be optional
      amount: 0,
      period: ContributionPeriod.Annually,
      monthlyAmount: 0,
      payFee: false,
      prorate: false
    });
  }

  @Post("/:id/payment-method/complete")
  async completeUpdatePaymentMethod(
    @TargetUser() target: Contact,
    @Body() data: CompleteJoinFlowDto
  ): Promise<ContributionInfo> {
    await this.handleCompleteUpdatePaymentMethod(target, data);
    return await this.getContribution(target);
  }

  private async handleStartUpdatePaymentMethod(
    target: Contact,
    data: StartContributionDto
  ) {
    if (!(await PaymentService.canChangeContribution(target, false, data))) {
      throw new CantUpdateContribution();
    }

    return await PaymentFlowService.createPaymentJoinFlow(
      {
        ...data,
        monthlyAmount: data.monthlyAmount,
        // TODO: unnecessary, should be optional
        password: await generatePassword(""),
        email: ""
      },
      {
        confirmUrl: "",
        loginUrl: "",
        setPasswordUrl: ""
      },
      data.completeUrl,
      target
    );
  }

  private async handleCompleteUpdatePaymentMethod(
    target: Contact,
    data: CompleteJoinFlowDto
  ): Promise<JoinFlow> {
    const joinFlow = await PaymentFlowService.getJoinFlowByPaymentId(
      data.paymentFlowId
    );
    if (!joinFlow) {
      throw new NotFoundError();
    }

    if (
      !(await PaymentService.canChangeContribution(
        target,
        false,
        joinFlow.joinForm
      ))
    ) {
      throw new CantUpdateContribution();
    }

    const completedFlow = await PaymentFlowService.completeJoinFlow(joinFlow);
    await PaymentService.updatePaymentMethod(target, completedFlow);

    return joinFlow;
  }

  @Authorized("admin")
  @Put("/:id/role/:roleType")
  async updateRole(
    @CurrentUser() caller: Contact,
    @TargetUser() target: Contact,
    @Params() { roleType }: ContactRoleParams,
    @Body() data: UpdateContactRoleDto
  ): Promise<GetContactRoleDto> {
    if (data.dateExpires && data.dateAdded >= data.dateExpires) {
      throw new BadRequestError();
    }

    if (roleType === "superadmin" && !caller.hasRole("superadmin")) {
      throw new UnauthorizedError();
    }

    const role = await ContactsService.updateContactRole(
      target,
      roleType,
      data
    );
    return ContactRoleTransformer.convert(role);
  }

  @Authorized("admin")
  @Delete("/:id/role/:roleType")
  @OnUndefined(201)
  async deleteRole(
    @CurrentUser() caller: Contact,
    @TargetUser() target: Contact,
    @Params() { roleType }: ContactRoleParams
  ): Promise<void> {
    if (roleType === "superadmin" && !caller.hasRole("superadmin")) {
      throw new UnauthorizedError();
    }

    const revoked = await ContactsService.revokeContactRole(target, roleType);
    if (!revoked) {
      throw new NotFoundError();
    }
  }
}
