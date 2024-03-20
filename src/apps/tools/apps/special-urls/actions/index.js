const { Members } = require("#core/database");
const {
  default: GCPaymentService
} = require("#core/services/GCPaymentService");

module.exports = [
  {
    name: "Log in",
    run: async (req) => {
      const member = await Members.findOne({ email: req.specialUrl.email });

      if (!member) {
        throw Error("Unknown member");
      }

      await new Promise((resolve) => {
        req.login(member, () => {
          // Force session to be temporary
          req.session.cookie.expires = false;
          resolve();
        });
      });

      return true;
    }
  },
  {
    name: "Log out",
    run: async (req) => {
      if (req.user) {
        req.logout();
      }
      return true;
    }
  },
  {
    name: "Change contribution",
    getParams: async () => [
      {
        name: "amount",
        label: "Amount",
        type: "number"
      },
      {
        name: "isAbsolute",
        label: "Absolute change?",
        type: "boolean"
      }
    ],
    run: async (req, res, { amount, isAbsolute }) => {
      if (!req.user) {
        res.redirect("/login?next=" + req.originalUrl);
        return false;
      }

      if (await GCPaymentService.canChangeContribution(req.user, true)) {
        await GCPaymentService.updateContribution(req.user, {
          monthlyAmount: isAbsolute
            ? amount
            : req.user.contributionMonthlyAmount + amount,
          period: req.user.contributionPeriod,
          payFee: false,
          prorate: false
        });
      } else {
        res.render("actions/cant-change-contribution");
        return false;
      }

      return true;
    }
  },
  {
    name: "Absorb fee",
    run: async (req, res) => {
      if (!req.user) {
        res.redirect("/login?next=" + req.originalUrl);
        return false;
      }

      if (await GCPaymentService.canChangeContribution(req.user, true)) {
        await GCPaymentService.updateContribution(req.user, {
          monthlyAmount: req.user.contributionMonthlyAmount,
          period: req.user.contributionPeriod,
          payFee: true,
          prorate: false
        });
      } else {
        res.render("actions/cant-change-contribution");
        return false;
      }

      return true;
    }
  },
  {
    name: "Set tag",
    getParams: async () => [
      {
        name: "tagName",
        label: "Tag",
        type: "string"
      }
    ],
    run: async (req, res, { tagName }) => {
      if (!req.user) {
        res.redirect("/login?next=" + req.originalUrl);
        return false;
      }

      await req.user.update({ $push: { tags: { name: tagName } } });
      return true;
    }
  },
  {
    name: "Set number of copies to deliver",
    getParams: async () => [
      {
        name: "copies",
        label: "Number of copies",
        type: "number"
      }
    ],
    run: async (req, res, { copies }) => {
      if (!req.user) {
        res.redirect("/login?next=" + req.originalUrl);
        return false;
      }

      await req.user.update({ $set: { delivery_copies: copies } });
      return true;
    }
  },
  {
    name: "Redirect to",
    getParams: async () => [
      {
        name: "url",
        label: "URL",
        type: "text"
      }
    ],
    run: async (req, res, { url }) => {
      res.redirect(url);
      return false; // Redirecting is always the last action
    }
  }
];
