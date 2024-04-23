import Stripe from "stripe";
import config from "@config";
import OptionsService from "@core/services/OptionsService";
import currentLocale, { locales } from "@locale";

export const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: "2023-10-16",
  typescript: true
});

/**
 * Get the tax rates by display name
 * @param displayName The display name
 * @param params The stripe request options, e.g. `{ limit: 1, active: true }`
 * @returns The tax rates
 */
export const stripeTaxRatesGetByDisplayName = async (
  displayName: string,
  params?: Stripe.TaxRateListParams
) => {
  return (await stripe.taxRates.list(params)).data.filter(
    (taxRate) => taxRate.display_name === displayName
  );
};

/**
 * Get the default display name for the tax rate.
 *
 * @returns The default display name
 */
export const stripeTaxRateGetDefaultDisplayName = () =>
  (currentLocale().membershipBuilder.steps.joinForm as any).taxRate ||
  locales.en.membershipBuilder.steps.joinForm.taxRate;

/**
 * Get the default tax rate.
 * This method gets the tax rate directly from stripe, so no request to our own database is made.
 *
 * @param active The active status of the tax rate, keep undefined to get all tax rates, also the disabled ones
 * @returns The default tax rate
 */
export const stripeTaxRateGetDefault = async (
  active?: boolean
): Promise<Stripe.TaxRate | undefined> => {
  const defaultId = OptionsService.get("tax-rate-stripe-default-id").value;
  if (defaultId) {
    const taxRate = await stripe.taxRates.retrieve(defaultId);
    if (taxRate.active === active) {
      return taxRate;
    }
  }
  const params: Stripe.TaxRateListParams = { limit: 1 };
  if (active) {
    params.active = active;
  }
  return (
    await stripeTaxRatesGetByDisplayName(
      stripeTaxRateGetDefaultDisplayName(),
      params
    )
  )?.[0];
};

/**
 * Rename the tax rate.
 * When existing tex rates are archived, we rename them with this function.
 * @param displayName
 * @param percentage
 * @returns
 */
const renameTaxRate = (displayName: string, percentage: number) => {
  return displayName + ` (${percentage}%)`;
};

/**
 * Get the old tax rates by display name and percentage
 * @param defaultDisplayName
 * @param percentage
 * @param id
 * @returns
 */
const getOldTaxRates = async (
  defaultDisplayName: string,
  percentage: number
) => {
  return [
    ...(await stripeTaxRatesGetByDisplayName(defaultDisplayName)),
    ...(await stripeTaxRatesGetByDisplayName(
      renameTaxRate(defaultDisplayName, percentage)
    ))
  ];
};

/**
 * Create or recreate the Beabee default tax rate on Stripe,
 * we currently only support this single tax rate.
 *
 * The tax rate cannot be changed for an existing tax object, so we have to create a new tax object if the tax rate is changed.
 *
 * Cases:
 * - If the tax rate percentage is not the same, we need to create a new tax rate and disable the old tax rate
 * - If the tax rate percentage is the same, we don't need to create a new tax rate, we just update the tax rate
 * - If the tax rate is not active, we don't need to create a new tax rate, we just update the tax rate if it exists
 * - If the tax rate is active but the old tax rate with the same percentage is found, we can just enable the old tax rate
 * - If the tax rate is active and the old tax rate with the same percentage is not found, we need to create a new tax rate
 *
 * @param data The tax rate data
 * @param percentage The tax rate percentage, seperate because it's not allowed to be updated
 * @param id The tax rate id
 * @param options The stripe request options
 */
export const stripeTaxRateCreateOrRecreateDefault = async function (
  percentage: number,
  data: Stripe.TaxRateUpdateParams &
    Pick<Stripe.TaxRateCreateParams, "metadata" | "country"> = {},
  options?: Stripe.RequestOptions
) {
  // Enabled if undefined or true
  data.active = data.active !== false;

  // Fallback to english if no locale is set for the current language
  const defaultDisplayName =
    data.display_name || stripeTaxRateGetDefaultDisplayName();

  const oldTaxRates = await getOldTaxRates(defaultDisplayName, percentage);

  let taxRateResult: Stripe.TaxRate | undefined;

  let activeUpdates = 0;

  for (const oldTaxRate of oldTaxRates) {
    // If the percentage is the same, we can update the existing tax rate
    if (
      activeUpdates === 0 &&
      percentage &&
      oldTaxRate?.percentage &&
      oldTaxRate.percentage === percentage
    ) {
      taxRateResult = await stripe.taxRates.update(
        oldTaxRate.id,
        {
          ...data,
          display_name: data.active
            ? defaultDisplayName
            : renameTaxRate(defaultDisplayName, oldTaxRate.percentage),
          country: config.stripe.country
        },
        options
      );
      // Only count active updates, because we only want to enable one
      if (data.active) {
        activeUpdates++;
      }
    }
    // The others can be disabledOtherwise we need to disable the old tax rate and create a new one
    else if (oldTaxRate) {
      await stripe.taxRates.update(
        oldTaxRate.id,
        {
          active: false,
          display_name: renameTaxRate(defaultDisplayName, oldTaxRate.percentage)
        },
        options
      );
    }
  }

  // If no updates were made and the tax rate is active, we need to create a new tax rate
  if (activeUpdates === 0 && data.active) {
    taxRateResult = await stripe.taxRates.create(
      {
        ...data,
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
