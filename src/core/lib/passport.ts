import passport from "passport";
import passportLocal from "passport-local";

import config from "@config";

import { getRepository } from "@core/database";
import { log } from "@core/logging";
import { cleanEmailAddress, sleep } from "@core/utils";
import { generatePassword, isValidPassword } from "@core/utils/auth";

import ContactsService from "@core/services/ContactsService";
import ContactMfaService from "@core/services/ContactMfaService";

import { CONTACT_MFA_TYPE } from "@enums/contact-mfa-type";
import { LOGIN_CODES } from "@enums/login-codes";
import { LoginDto } from "@api/dto/LoginDto";
import { UnauthorizedError } from "@api/errors/UnauthorizedError";

import Contact from "@models/Contact";

import type { ContactMfaSecure } from "@type/contact-mfa-secure";
import type { PassportLocalDoneCallback } from "@type/passport-local-done-callback";

// Add support for local authentication in Passport.js
passport.use(
  new passportLocal.Strategy(
    {
      usernameField: "email",
      passReqToCallback: true
    },
    async function (
      req: { body: LoginDto },
      email: string,
      password: string,
      done: PassportLocalDoneCallback
    ) {
      const token = req.body.token;

      email = cleanEmailAddress(email);

      const contact = await ContactsService.findOneBy({ email });

      let code = LOGIN_CODES.LOGIN_FAILED;

      // Check if contact for email exists
      if (contact) {
        code = await isValidPassword(contact.password, password);

        if (code === LOGIN_CODES.LOGGED_IN) {
          // Reset tries
          await ContactsService.resetPasswordTries(contact);

          // Check if password needs to be rehashed
          if (contact.password.iterations < config.passwordIterations) {
            await ContactsService.updateContact(contact, {
              password: await generatePassword(password)
            });
          }

          // Check MFA
          const mfa = await ContactMfaService.get(contact);
          if (mfa) {
            return loginWithMfa(mfa, contact, token, done);
          }

          // User is logged in without 2FA
          return done(null, contact, { message: LOGIN_CODES.LOGGED_IN });
        } else {
          await ContactsService.incrementPasswordTries(contact);
        }
      }

      // Delay by 1 second to slow down password guessing
      await sleep(1000);
      return done(null, false, { message: code });
    }
  )
);

/**
 * Check if multi factor authentication is enabled and supported
 * @param mfa The multi factor authentication information
 * @param contact The contact
 * @param token The multi factor authentication token
 * @param done The passport done callback
 */
const loginWithMfa = async (
  mfa: ContactMfaSecure,
  contact: Contact,
  token: string | undefined,
  done: PassportLocalDoneCallback
) => {
  if (mfa.type !== CONTACT_MFA_TYPE.TOTP) {
    log.warn("The user has unsupported 2FA enabled.");
    // We pass the contact to the done callback so the user can be logged in and the 2FA is ignored
    return done(null, contact, {
      message: LOGIN_CODES.UNSUPPORTED_2FA
    });
  }

  // If user has no token, notify client that 2FA is required
  if (!token) {
    return done(
      new UnauthorizedError({ code: LOGIN_CODES.REQUIRES_2FA }),
      false
    );
  }

  // Check token..
  const { isValid, delta } = await ContactMfaService.checkToken(
    contact,
    token,
    1
  );

  // .. if invalid notify client
  if (!isValid) {
    return done(
      new UnauthorizedError({
        code: LOGIN_CODES.INVALID_TOKEN,
        message: "Invalid 2FA token" + delta ? ` (delta: ${delta})` : ""
      }),
      false
    );
  }

  // Looks good, return user
  return done(null, contact, { message: LOGIN_CODES.LOGGED_IN });
};

// Passport.js serialise user function
passport.serializeUser(function (data, done) {
  done(null, (data as Contact).id);
});

// Passport.js deserialise user function
passport.deserializeUser(async function (data, done) {
  try {
    if (typeof data === "string") {
      const contact = await ContactsService.findOneBy({ id: data });
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
