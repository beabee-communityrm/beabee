import _Stripe from "stripe";
import config from "@config";
import OptionsService, { OptionKey } from "@core/services/OptionsService";

class TaxRatesResource extends _Stripe.TaxRatesResource {
  constructor() {
    super();
  }

  /** Update or create the default tax rate */
  public async updateOrCreateDefault(
    data: _Stripe.TaxRateUpdateParams &
      Partial<_Stripe.TaxRateCreateParams> &
      Pick<_Stripe.TaxRateCreateParams, "country" | "percentage" | "metadata">,
    id?: string,
    options?: _Stripe.RequestOptions
  ) {
    const defaultDisplayName = OptionsService.get(
      "tax-rate-strapi-default-display-name"
    ).value;
    const taxRateInclusive =
      OptionsService.get("tax-rate-inclusive").value === "true";

    if (!id) {
      id = (await this.list()).data.find(
        (taxRate) => taxRate.display_name === defaultDisplayName
      )?.id;
    }

    if (id) {
      return this.update(id, data, options);
    }

    const create: _Stripe.TaxRateCreateParams = {
      display_name: defaultDisplayName,
      inclusive: taxRateInclusive,
      ...data
    };

    return await this.create(create, options);
  }
}

class Stripe extends _Stripe {
  taxRates: TaxRatesResource;
  constructor(
    apiKey = config.stripe.secretKey,
    options: _Stripe.StripeConfig = {
      apiVersion: "2023-10-16" as "2023-10-16",
      typescript: true as true
    }
  ) {
    super(apiKey, options);

    this.taxRates = new TaxRatesResource();
  }
}

export default new Stripe();
