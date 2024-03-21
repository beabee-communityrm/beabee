import axios from "axios";
import crypto from "crypto";
import { Request } from "express";
import {
  Customer,
  CustomerBankAccount,
  Mandate,
  Payment,
  RedirectFlow,
  RedirectFlowPrefilledCustomer,
  Refund,
  Subscription
} from "gocardless-nodejs/types/Types";
import { v4 as uuidv4 } from "uuid";

import { log as mainLogger } from "#core/logging";

import config from "#config";
import { DeepPartial } from "typeorm";

const log = mainLogger.child({ app: "gocardless-api" });

const gocardless = axios.create({
  baseURL: `https://${
    config.gocardless.sandbox ? "api-sandbox" : "api"
  }.gocardless.com`,
  headers: {
    Authorization: `Bearer ${config.gocardless.accessToken}`,
    "GoCardless-Version": "2015-07-06",
    Accept: "application/json",
    "Content-Type": "application/json"
  }
});

gocardless.interceptors.request.use((config) => {
  log.info(`${config.method} ${config.url}`, {
    params: config.params,
    data: config.data
  });

  if (config.method === "post") {
    config.headers["Idempotency-Key"] = uuidv4();
  }
  return config;
});

function isCancellationFailed(error: any) {
  return (
    error.response &&
    error.response.status === 422 &&
    error.response.data.error?.errors?.some(
      (e: any) => e.reason === "cancellation_failed"
    )
  );
}

gocardless.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    // Ignore cancellation_failed errors as it just means the thing was already cancelled
    if (isCancellationFailed(error)) {
      return { data: {} }; // This will never be used but is a bit hacky
    } else {
      log.error(`GoCardless API returned ${error.response.status}`, {
        status: error.response.status,
        data: error.response.data
      });
      throw error;
    }
  }
);

const STANDARD_METHODS = ["create", "get", "update", "list", "all"];

interface Methods<T, C> {
  create(data: DeepPartial<C>): Promise<T>;
  list(params?: Record<string, unknown>): Promise<T[]>;
  all(params?: Record<string, unknown>): Promise<T[]>;
  get(id: string, params?: Record<string, unknown>): Promise<T>;
  update(id: string, data: DeepPartial<T>): Promise<T>;
  remove(id: string): Promise<boolean>;
  [key: string]: any;
}

interface Actions<T> {
  cancel(id: string): Promise<T>;
  complete(id: string, data?: Record<string, unknown>): Promise<T>;
}

function createMethods<T, C = T>(
  key: string,
  allowedMethods: string[],
  allowedActions: string[] = []
): Methods<T, C> & Actions<T> {
  const endpoint = `/${key}`;

  const methods: Methods<T, C> = {
    async create(data) {
      const response = await gocardless.post(endpoint, { [key]: data });
      return <T>response.data[key];
    },
    async list(params) {
      const response = await gocardless.get(endpoint, { params });
      return <T[]>response.data[key];
    },
    async all(params) {
      const {
        data: { meta, [key]: resources }
      } = await gocardless.get(endpoint, { params });

      const moreResources = meta.cursors.after
        ? await this.all({ ...params, after: meta.cursors.after })
        : [];

      return <T[]>[...resources, ...moreResources];
    },
    async get(id, params) {
      const response = await gocardless.get(`${endpoint}/${id}`, { params });
      return <T>response.data[key];
    },
    async update(id, data) {
      const response = await gocardless.put(`${endpoint}/${id}`, {
        [key]: data
      });
      return <T>response.data[key];
    },
    async remove(id) {
      const response = await gocardless.delete(`${endpoint}/${id}`);
      return response.status < 300;
    }
  };

  function actionMethod(action: string) {
    return async (id: string, data?: Record<string, unknown>) => {
      const response = await gocardless.post(
        `${endpoint}/${id}/actions/${action}`,
        { data }
      );
      return response.data[key];
    };
  }

  return Object.assign(
    {},
    ...allowedMethods.map((method) => ({ [method]: methods[method] })),
    ...allowedActions.map((action) => ({ [action]: actionMethod(action) }))
  );
}

interface CreateRedirectFlow extends RedirectFlow {
  prefilled_customer: RedirectFlowPrefilledCustomer;
}

export default {
  //creditors: createMethods<Creditor>('creditors', STANDARD_METHODS),
  //creditorBankAccounts: createMethods<CreditorBankAccount>('creditor_bank_accounts', ['create', 'get', 'list', 'all'], ['disable']),
  customers: createMethods<Customer>("customers", [
    ...STANDARD_METHODS,
    "remove"
  ]),
  customerBankAccounts: createMethods<CustomerBankAccount>(
    "customer_bank_accounts",
    STANDARD_METHODS,
    ["disable"]
  ),
  //events: createMethods<Event>('events', ['get', 'list', 'all']),
  mandates: createMethods<Mandate>("mandates", STANDARD_METHODS, [
    "cancel",
    "reinstate"
  ]),
  //mandateImports: createMethods<MandateImport>('mandate_imports', ['create', 'get'], ['submit', 'cancel']),
  //mandateImportEntries: createMethods<MandateImportEntry>('mandate_import_entries', ['create', 'list', 'all']),
  payments: createMethods<Payment>("payments", STANDARD_METHODS, [
    "cancel",
    "retry"
  ]),
  //payouts: createMethods<Payout>('payouts', ['get', 'list', 'all']),
  //payoutItems: createMethods<PayoutItem>('payout_items', ['list', 'all']),
  redirectFlows: createMethods<RedirectFlow, CreateRedirectFlow>(
    "redirect_flows",
    ["create", "get"],
    ["complete"]
  ),
  refunds: createMethods<Refund>("refunds", STANDARD_METHODS),
  subscriptions: createMethods<Subscription>(
    "subscriptions",
    STANDARD_METHODS,
    ["cancel"]
  ),
  webhooks: {
    validate(req: Request): boolean {
      return (
        req.body &&
        req.headers["content-type"] === "application/json" &&
        req.headers["webhook-signature"] ===
          crypto
            .createHmac("sha256", config.gocardless.secret)
            .update(req.body)
            .digest("hex")
      );
    }
  }
};
