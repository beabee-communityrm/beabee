import * as env from "./env";

export interface SMTPEmailConfig {
  provider: "smtp";
  settings: {
    host: string;
    port: number;
    auth: {
      user: string;
      pass: string;
    };
  };
}

export interface MandrillEmailConfig {
  provider: "mandrill";
  settings: {
    apiKey: string;
  };
}

type EmailConfig = SMTPEmailConfig | MandrillEmailConfig;

const emailProvider = env.e("BEABEE_EMAIL_PROVIDER", [
  "mandrill",
  "smtp"
] as const);

export interface MailchimpNewsletterConfig {
  provider: "mailchimp";
  settings: {
    apiKey: string;
    datacenter: string;
    listId: string;
    webhookSecret: string;
  };
}

interface NoneNewsletterConfig {
  provider: "none";
  settings: null;
}

type NewsletterConfig = MailchimpNewsletterConfig | NoneNewsletterConfig;

const newsletterProvider = env.e(
  "BEABEE_NEWSLETTER_PROVIDER",
  ["mailchimp", "none"] as const,
  "none"
);

export interface AppConfig {
  uid: string;
  title: string;
  path: string;
  disabled: boolean;
  priority: number;
  appPath: string;
  hidden?: boolean;
  subApps: AppConfig[];
  menu: "none" | "main";
  permissions: string[];
}

export type AppConfigOverrides = Record<string, AppConfigOverride>;

export interface AppConfigOverride {
  config?: Partial<AppConfig>;
  subApps?: AppConfigOverrides;
}

export default {
  audience: env.s("BEABEE_AUDIENCE"),
  dev: env.b("BEABEE_DEV"),
  secret: env.s("BEABEE_SECRET"),
  session: env.s("BEABEE_SESSION", "session"),
  cookie: {
    secure: false,
    httpOnly: true,
    domain: env.s("BEABEE_COOKIE_DOMAIN"),
    path: "/",
    maxAge: 267840000
  },
  trackDomains: env.ss("BEABEE_TRACKDOMAINS", []),
  discourse: {
    url: env.s("BEABEE_DISCOURSE_URL", ""),
    ssoSecret: env.s("BEABEE_DISCOURSE_SSOSECRET", "")
  },
  email: {
    provider: emailProvider,
    settings:
      emailProvider === "smtp"
        ? {
            host: env.s("BEABEE_EMAIL_SETTINGS_HOST"),
            port: env.s("BEABEE_EMAIL_SETTINGS_PORT"),
            auth: {
              user: env.s("BEABEE_EMAIL_SETTINGS_AUTH_USER"),
              pass: env.s("BEABEE_EMAIL_SETTINGS_AUTH_PASS")
            }
          }
        : {
            apiKey: env.s("BEABEE_EMAIL_SETTINGS_APIKEY")
          }
  } as EmailConfig,
  newsletter: {
    provider: newsletterProvider,
    settings:
      newsletterProvider === "mailchimp"
        ? {
            apiKey: env.s("BEABEE_NEWSLETTER_SETTINGS_APIKEY", ""),
            datacenter: env.s("BEABEE_NEWSLETTER_SETTINGS_DATACENTER", ""),
            listId: env.s("BEABEE_NEWSLETTER_SETTINGS_LISTID", ""),
            webhookSecret: env.s("BEABEE_NEWSLETTER_SETTINGS_WEBHOOKSECRET", "")
          }
        : null
  } as NewsletterConfig,
  gocardless: {
    accessToken: env.s("BEABEE_GOCARDLESS_ACCESSTOKEN", ""),
    secret: env.s("BEABEE_GOCARDLESS_SECRET", ""),
    sandbox: env.b("BEABEE_GOCARDLESS_SANDBOX", true)
  },
  stripe: {
    publicKey: env.s("BEABEE_STRIPE_PUBLICKEY", ""),
    secretKey: env.s("BEABEE_STRIPE_SECRETKEY", ""),
    webhookSecret: env.s("BEABEE_STRIPE_WEBHOOKSECRET", "")
  },
  currencyCode: env.s("BEABEE_CURRENCYCODE"),
  currencySymbol: env.s("BEABEE_CURRENCYSYMBOL"),
  passwordTries: env.n("BEABEE_PASSWORDTRIES", 3),
  passwordIterations: env.n("BEABEE_PASSWORDITERATIONS", 50000),
  gracePeriod: {
    days: 5
  },
  logSlack: env.s("BEABEE_LOGSLACK_LEVEL", "") && {
    level: env.s("BEABEE_LOGSLACK_LEVEL"),
    webhookUrl: env.s("BEABEE_LOGSLACK_WEBHOOKURL"),
    channel: env.s("BEABEE_LOGSLACK_CHANNEL"),
    username: env.s("BEABEE_LOGSLACK_USERNAME")
  },
  appOverrides: env.json("BEABEE_APPOVERRIDES", {}) as AppConfigOverrides
};
