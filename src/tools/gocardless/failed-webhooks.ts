import "module-alias/register";

import gocardless from "@core/lib/gocardless";

async function main() {
  const webhooks = await gocardless.webhooks.all({
    successful: false
  });

  console.log(`Found ${webhooks.length} failed webhooks`);
  for (const webhook of webhooks) {
    console.log(webhook.request_body);
  }

  if (process.argv[2] === "--process") {
    for (const webhook of webhooks) {
      console.log("Reprocessing webhook " + webhook.id);
      await gocardless.webhooks.retry(webhook.id);
    }
  }
}

main().catch((err) => console.error(err));
