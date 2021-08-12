import * as env from "./env";

interface SMTPEmail {
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

interface MandrillEmail {
  provider: "mandrill";
  settings: {
    apiKey: string;
  };
}

type Email = SMTPEmail | MandrillEmail;

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
    provider: "smtp",
    settings: {
      host: "mail",
      port: 1025,
      auth: {
        user: "dev",
        pass: "dev"
      }
    }
  } as Email,
  _email: {
    provider: "mandrill",
    settings: {
      apiKey: env.s("BEABEE_EMAIL_SETTINGS_APIKEY", "")
    }
  } as Email,
  newsletter: {
    provider: "mailchimp",
    settings: {
      apiKey: env.s("BEABEE_NEWSLETTER_SETTINGS_APIKEY", ""),
      datacenter: env.s("BEABEE_NEWSLETTER_SETTINGS_DATACENTER", ""),
      listId: env.s("BEABEE_NEWSLETTER_SETTINGS_LISTID", ""),
      webhookSecret: env.s("BEABEE_NEWSLETTER_SETTINGS_WEBHOOKSECRET", "")
    }
  },
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
    webhookUrl: env.s("BEABEE_LOGSKAC_WEBHOOKURL"),
    channel: env.s("BEABEE_LOGSLACK_CHANNEL"),
    username: env.s("BEABEE_LOGSLACK_USERNAME")
  },
  appOverrides: {}
};
