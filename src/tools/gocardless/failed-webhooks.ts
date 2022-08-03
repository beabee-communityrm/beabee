import "module-alias/register";

import gocardless from "@core/lib/gocardless";

async function main(
  startDate: string | undefined,
  endDate: string | undefined
) {
  const webhooks = await gocardless.webhooks.all({
    successful: false,
    ...(startDate && { "created_at[gte]": startDate }),
    ...(endDate && { "created_at[lte]": endDate })
  });

  console.log(`Found ${webhooks.length} failed webhooks`);
  for (const webhook of webhooks) {
    console.log(webhook.request_body);
  }

  if (isRetry) {
    console.log("here");
    return;
    for (const webhook of webhooks) {
      console.log("Retrying webhook " + webhook.id);
      await gocardless.webhooks.retry(webhook.id);
    }
  }
}

const isRetry = process.argv[2] === "--retry";
const [startDate, endDate] = process.argv.slice(isRetry ? 3 : 2);

main(startDate, endDate).catch((err) => console.error(err));
