import Stripe from "stripe";
import config from "@config";
import OptionsService from "@core/services/OptionsService";
import currentLocale, { locales } from "@locale";

export const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: "2023-10-16",
  typescript: true
});

export const stripeTaxRateGetByDisplayName = async (displayName: string) => {
  return (await stripe.taxRates.list({ active: true })).data.find(
    (taxRate) => taxRate.display_name === displayName
  );
};

/**
 * Get the default display name for the tax rate
 *
 * @returns The default display name
 */
export const stripeTaxRateGetDefaultDisplayName = () =>
  (currentLocale().membershipBuilder.steps.joinForm as any).taxRate ||
  locales.en.membershipBuilder.steps.joinForm.taxRate;

/**
 * Create or recreate the Beabee default tax rate on Stripe,
 * we currently only support this single tax rate.
 *
 * The tax rate cannot be changed for an existing tax object, so we have to create a new tax object if the tax rate is changed.
 *
 * @param data The tax rate data
 * @param percentage The tax rate percentage, seperate because it's not allowed to be updated
 * @param id The tax rate id
 * @param options The stripe request options
 */
export const stripeTaxRateCreateOrRecreateDefault = async function (
  percentage: number,
  data: Stripe.TaxRateUpdateParams &
    Pick<Stripe.TaxRateCreateParams, "metadata"> = {},
  id: string = OptionsService.get("tax-rate-stripe-default-id").value,
  options?: Stripe.RequestOptions
) {
  // Fallback to english if no locale is set for the current language
  const defaultDisplayName =
    data.display_name || stripeTaxRateGetDefaultDisplayName();

  const oldTaxRate = id
    ? await stripe.taxRates.retrieve(id)
    : await stripeTaxRateGetByDisplayName(defaultDisplayName);

  // If the tax rate percentage is not the same, we need to create a new tax rate
  const needCreate =
    (percentage &&
      // undefined or true
      data.active !== false &&
      oldTaxRate &&
      oldTaxRate.active &&
      oldTaxRate.percentage !== percentage) ||
    !oldTaxRate?.active;

  let taxRateResult: Stripe.TaxRate | undefined;

  // Disable old tax rate if it exists and we need to create a new one (delete an existing tax rate is not possible)
  if (needCreate && oldTaxRate?.id) {
    taxRateResult = await stripe.taxRates.update(
      oldTaxRate.id,
      {
        active: false,
        display_name: defaultDisplayName + ` (${oldTaxRate.percentage}%)`
      },
      options
    );
  }
  // Update old tax rate if it exists and we don't need to create a new one
  // Or disable the tax rate if `active` is false
  else if (oldTaxRate?.id) {
    taxRateResult = await stripe.taxRates.update(
      oldTaxRate.id,
      {
        ...data,
        active: data.active !== false,
        display_name: defaultDisplayName,
        country: config.stripe.country
      },
      options
    );
  } else {
    console.warn("Tax rate is not active, not creating");
  }

  // Create a new tax rate if it doesn't exist or we need to create a new one
  if (needCreate || !taxRateResult) {
    taxRateResult = await stripe.taxRates.create(
      {
        ...data,
        active: true,
        display_name: defaultDisplayName,
        inclusive: true,
        country: config.stripe.country,
        percentage
      },
      options
    );
  }

  return taxRateResult;
};

export { Stripe };
