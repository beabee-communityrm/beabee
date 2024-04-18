import Stripe from "stripe";
import config from "@config";
import OptionsService from "@core/services/OptionsService";

export const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: "2023-10-16",
  typescript: true
});

/**
 * Update or create the Beabee default tax rate on Stripe,
 * we currently only support this single tax rate.
 * */
export const taxRateUpdateOrCreateDefault = async function (
  this: Stripe.TaxRatesResource,
  data: Stripe.TaxRateUpdateParams &
    Partial<Stripe.TaxRateCreateParams> &
    Pick<Stripe.TaxRateCreateParams, "percentage" | "metadata">,
  id?: string,
  options?: Stripe.RequestOptions
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

  const create: Stripe.TaxRateCreateParams = {
    display_name: defaultDisplayName,
    inclusive: taxRateInclusive, // Determines whether the tax percentage is added to, or included in, the overall amount, see https://docs.stripe.com/billing/taxes/tax-rates#inclusive-vs-exclusive-tax
    country: config.stripe.country,
    ...data
  };

  return await this.create(create, options);
}.bind(stripe.taxRates);

export { Stripe };
