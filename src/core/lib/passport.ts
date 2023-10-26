import passport from "passport";
import passportLocal from "passport-local";
import { getRepository } from "typeorm";

import config from "@config";

import { log } from "@core/logging";
import { cleanEmailAddress, sleep } from "@core/utils";
import { generatePassword, hashPassword } from "@core/utils/auth";

import OptionsService from "@core/services/OptionsService";
import ContactsService from "@core/services/ContactsService";
import ContactMfaService from "@core/services/ContactMfaService";

import {
  ContactMfaType,
  LOGIN_CODES,
  PassportLocalDoneCallback
} from "@api/data/ContactData/interface";

import Contact from "@models/Contact";

// Add support for local authentication in Passport.js
passport.use(
  new passportLocal.Strategy(
    {
      usernameField: "email"
    },
    async function (email, password, done: PassportLocalDoneCallback) {
      if (email) email = cleanEmailAddress(email);

      const contact = await ContactsService.findOne({ email });

      // Check if contact for email exists
      if (contact) {
        const tries = contact.password.tries || 0;

        // Has account exceeded it's password tries?
        if (tries >= config.passwordTries) {
          return done(null, false, { message: LOGIN_CODES.LOCKED });
        }

        // Check if password salt is set
        if (!contact.password.salt) {
          return done(null, false, { message: LOGIN_CODES.LOGIN_FAILED });
        }

        // Generate hash from password
        const hash = await hashPassword(
          password,
          contact.password.salt,
          contact.password.iterations
        );

        // Check if password matches
        if (hash === contact.password.hash) {
          // Reset tries
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

          // Check if password needs to be rehashed
          if (contact.password.iterations < config.passwordIterations) {
            await ContactsService.updateContact(contact, {
              password: await generatePassword(password)
            });
          }

          const mfa = await ContactMfaService.get(contact);

          // Check if multi factor authentication is enabled and supported
          if (mfa) {
            if (mfa.type !== ContactMfaType.TOTP) {
              log.warn("The user has unsupported 2FA enabled.");
              // We pass the contact to the done callback so the user can be logged in and the 2FA is ignored
              return done(null, contact, {
                message: LOGIN_CODES.UNSUPPORTED_2FA
              });
            }

            // Please see AuthController for the rest of this authentication flow
            return done(null, contact, { message: LOGIN_CODES.REQUIRES_2FA });
          }

          // User is logged in
          return done(null, contact, { message: LOGIN_CODES.LOGGED_IN });
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
      return done(null, false, { message: LOGIN_CODES.LOGIN_FAILED });
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
