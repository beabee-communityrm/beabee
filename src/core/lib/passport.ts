import passport from "passport";
import passportLocal from "passport-local";
import passportTotp from "passport-totp";
import { getRepository } from "typeorm";

import config from "@config";

import { cleanEmailAddress, sleep } from "@core/utils";
import { generatePassword, hashPassword } from "@core/utils/auth";

import OptionsService from "@core/services/OptionsService";
import ContactsService from "@core/services/ContactsService";

import Contact from "@models/Contact";

// Add support for local authentication in Passport.js
passport.use(
  new passportLocal.Strategy(
    {
      usernameField: "email"
    },
    async function (email, password, done) {
      if (email) email = cleanEmailAddress(email);

      const contact = await ContactsService.findOne({ email });
      if (contact) {
        const tries = contact.password.tries || 0;
        // Has account exceeded it's password tries?
        if (tries >= config.passwordTries) {
          return done(null, false, { message: "account-locked" });
        }

        if (!contact.password.salt) {
          return done(null, false, { message: "login-failed" });
        }

        const hash = await hashPassword(
          password,
          contact.password.salt,
          contact.password.iterations
        );
        if (hash === contact.password.hash) {
          if (tries > 0) {
            await ContactsService.updateContact(contact, {
              password: { ...contact.password, tries: 0 }
            });
            return done(null, contact, {
              message: OptionsService.getText("flash-account-attempts").replace(
                "%",
                tries.toString()
              )
            });
          }

          if (contact.password.iterations < config.passwordIterations) {
            await ContactsService.updateContact(contact, {
              password: await generatePassword(password)
            });
          }

          return done(null, contact, { message: "logged-in" });
        } else {
          // If password doesn't match, increment tries and save
          contact.password.tries = tries + 1;
          await ContactsService.updateContact(contact, {
            password: { ...contact.password, tries: tries + 1 }
          });
        }
      }

      // Delay by 1 second to slow down password guessing
      await sleep(1000);
      return done(null, false, { message: "login-failed" });
    }
  )
);

// Add support for TOTP authentication in Passport.js
passport.use(
  new passportTotp.Strategy(
    {
      window: 1
    },
    function (_user, done) {
      const user = _user as Contact;
      if (user.otp.key) {
        return done(null, Buffer.from(user.otp.key, "base64").toString(), 30);
      }
      return done(null, false);
    }
  )
);

// Passport.js serialise user function
passport.serializeUser(function (data, done) {
  done(null, (data as Contact).id);
});

// Passport.js deserialise user function
passport.deserializeUser(async function (data, done) {
  try {
    if (typeof data === "string") {
      const contact = await ContactsService.findOne(data);
      if (contact) {
        // Debounce last seen updates, we don't need to know to the second
        const now = new Date();
        if (!contact.lastSeen || +now - +contact.lastSeen > 60000) {
          // Don't use ContactsService.updateContact to avoid overhead
          await getRepository(Contact).update(contact.id, { lastSeen: now });
          contact.lastSeen = now;
        }

        return done(null, contact);
      }
    }
    done(null, false);
  } catch (err) {
    done(err);
  }
});

export default passport;
