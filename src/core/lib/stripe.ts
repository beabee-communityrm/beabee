import Stripe from "stripe";
import config from "@config";

export default new Stripe(config.stripe.secretKey, {
  apiVersion: "2023-10-16",
  typescript: true
});
