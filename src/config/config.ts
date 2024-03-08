import * as env from "./env";

export interface SMTPEmailConfig {
  provider: "smtp";
  settings: {
    host: string;
    port: number;
    secure: boolean;
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

export interface SendGridEmailConfig {
  provider: "sendgrid";
  settings: {
    apiKey: string;
    testMode: boolean;
  };
}

type EmailConfig = SMTPEmailConfig | MandrillEmailConfig | SendGridEmailConfig;

const emailProvider = env.e("BEABEE_EMAIL_PROVIDER", [
  "mandrill",
  "sendgrid",
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
  settings: {
    webhookSecret: string;
  };
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
  serviceSecret: env.s("BEABEE_SERVICE_SECRET"),
  session: env.s("BEABEE_SESSION", "session"),
  cookie: {
    domain: env.s("BEABEE_COOKIE_DOMAIN"),
    secure: env.b("BEABEE_COOKIE_SECURE", true)
  },
  trustedOrigins: env.ss("BEABEE_TRUSTEDORIGINS", []),
  databaseUrl: env.s("BEABEE_DATABASE_URL"),
  captchaFox: {
    secret: env.s("BEABEE_CAPTCHAFOX_SECRET", "")
  },
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
            secure: env.b("BEABEE_EMAIL_SETTINGS_SECURE", false),
            auth: {
              user: env.s("BEABEE_EMAIL_SETTINGS_AUTH_USER"),
              pass: env.s("BEABEE_EMAIL_SETTINGS_AUTH_PASS")
            }
          }
        : emailProvider === "mandrill"
          ? {
              apiKey: env.s("BEABEE_EMAIL_SETTINGS_APIKEY")
            }
          : {
              apiKey: env.s("BEABEE_EMAIL_SETTINGS_APIKEY"),
              testMode: env.b("BEABEE_EMAIL_SETTIGS_TESTMODE", false)
            }
  } as EmailConfig,
  newsletter: {
    provider: newsletterProvider,
    settings: {
      webhookSecret: env.s("BEABEE_NEWSLETTER_SETTINGS_WEBHOOKSECRET", ""),
      ...(newsletterProvider === "mailchimp"
        ? {
            apiKey: env.s("BEABEE_NEWSLETTER_SETTINGS_APIKEY"),
            datacenter: env.s("BEABEE_NEWSLETTER_SETTINGS_DATACENTER"),
            listId: env.s("BEABEE_NEWSLETTER_SETTINGS_LISTID")
          }
        : null)
    }
  } as NewsletterConfig,
  gocardless: {
    accessToken: env.s("BEABEE_GOCARDLESS_ACCESSTOKEN", ""),
    secret: env.s("BEABEE_GOCARDLESS_SECRET", ""),
    sandbox: env.b("BEABEE_GOCARDLESS_SANDBOX", true)
  },
  stripe: {
    publicKey: env.s("BEABEE_STRIPE_PUBLICKEY", ""),
    secretKey: env.s("BEABEE_STRIPE_SECRETKEY", ""),
    webhookSecret: env.s("BEABEE_STRIPE_WEBHOOKSECRET", ""),
    membershipProductId: env.s("BEABEE_STRIPE_MEMBERSHIPPRODUCTID", ""),
    country: env.e("BEABEE_STRIPE_COUNTRY", ["gb", "eu", "ca"] as const, "gb")
  },
  countryCode: env.e("BEABEE_COUNTRYCODE", ["en", "de", "be"] as const),
  currencyCode: env.s("BEABEE_CURRENCYCODE"),
  currencySymbol: env.s("BEABEE_CURRENCYSYMBOL"),
  passwordTries: env.n("BEABEE_PASSWORDTRIES", 3),
  passwordIterations: env.n("BEABEE_PASSWORDITERATIONS", 50000),
  gracePeriod: {
    days: 7
  },
  logFormat: env.e("BEABEE_LOGFORMAT", ["json", "simple"] as const, "json"),
  appOverrides: env.json("BEABEE_APPOVERRIDES", {}) as AppConfigOverrides
};
