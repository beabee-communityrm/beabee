import crypto from "crypto";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { getNextParam } from "@core/utils";
import { TOTP, Secret } from "otpauth";

import Contact from "@models/Contact";
import Password from "@models/Password";

import config from "@config";

export function generateJWTToken(contact: Contact): string {
  return jwt.sign({ contactId: contact.id }, config.secret);
}

export function parseJWTToken(token: string): string {
  const { contactId } = jwt.verify(token, config.secret) as {
    contactId: string;
  };
  return contactId;
}

export enum AuthenticationStatus {
  LOGGED_IN = 1,
  NOT_LOGGED_IN = 0,
  NOT_MEMBER = -1,
  NOT_ADMIN = -2,
  REQUIRES_2FA = -3
}

/**
 * Validate 2FA TOTP token
 *
 * @param secret The secret key encoded in base32
 * @param token The token to validate
 * @param window The larger this value is, the greater the time difference between the user and server that will be tolerated, but it also becomes increasingly less secure.
 * @returns
 */
export const validateTotpToken = (
  secret: string,
  token: string,
  window = 1
) => {
  const totp = new TOTP({
    secret: Secret.fromBase32(secret)
  });

  const delta = totp.validate({ token, window });
  const isValid = delta === 0;

  return {
    isValid,
    delta
  };
};

/**
 * Used for generating an OTP secret for 2FA
 * @returns a base32 encoded string of random bytes
 * @deprecated This is the old implementation, use {@link validateTotpToken} instead.
 */
export function generateOTPSecret(): Promise<string> {
  return new Promise((resolve) => {
    crypto.randomBytes(16, function (ex, raw) {
      const secret = Buffer.from(raw);
      resolve(secret.toString("base64").replace(/=/g, ""));
    });
  });
}

export function generateCode(): string {
  return crypto.randomBytes(10).toString("hex");
}

/**
 * Used to create a long salt for each individual user
 * @returns a 256 byte / 512 character hex string
 */
export function generateSalt(): Promise<string> {
  return new Promise((resolve) => {
    crypto.randomBytes(256, function (ex, salt) {
      resolve(salt.toString("hex"));
    });
  });
}

export function generateApiKey(
  idLength: number = 16,
  secretLength: number = 48
): {
  id: string;
  secret: string;
  secretHash: string;
  token: string;
} {
  const id = crypto.randomBytes(idLength / 2).toString("hex");
  const secret = crypto.randomBytes(secretLength / 2).toString("hex");
  const secretHash = crypto.createHash("sha256").update(secret).digest("hex");
  const token = `${id}_${secret}`;
  return { id, secret, secretHash, token };
}

/**
 * Hashes passwords through sha512 1000 times
 * returns a 512 byte / 1024 character hex string
 * @param password
 * @param salt
 * @param iterations
 * @returns
 */
export function hashPassword(
  password: string,
  salt: string,
  iterations: number
): Promise<string> {
  return new Promise((resolve) => {
    crypto.pbkdf2(
      password,
      salt,
      iterations,
      512,
      "sha512",
      function (err, hash) {
        resolve(hash.toString("hex"));
      }
    );
  });
}

/**
 * Utility function generates a salt and hash from a plain text password
 * @param password The plain text password to hash
 * @returns
 */
export async function generatePassword(password: string): Promise<Password> {
  const salt = await generateSalt();
  const hash = await hashPassword(password, salt, config.passwordIterations);
  return {
    salt,
    hash,
    iterations: config.passwordIterations,
    tries: 0
  };
}

// Checks the user is logged in and activated.
export function loggedIn(req: Request): AuthenticationStatus {
  // Is the user logged in?
  if (req.isAuthenticated() && req.user) {
    // Is the user active
    if (
      !req.user.otp.activated ||
      (req.user.otp.activated && req.session.method == "totp")
    ) {
      return AuthenticationStatus.LOGGED_IN;
    } else {
      return AuthenticationStatus.REQUIRES_2FA;
    }
  } else {
    return AuthenticationStatus.NOT_LOGGED_IN;
  }
}

// Checks if the user has an active admin or superadmin privilege
export function canAdmin(req: Request): AuthenticationStatus {
  // Check user is logged in
  const status = loggedIn(req);
  if (status != AuthenticationStatus.LOGGED_IN) {
    return status;
  } else if (req.user?.hasRole("admin")) {
    return AuthenticationStatus.LOGGED_IN;
  }
  return AuthenticationStatus.NOT_ADMIN;
}

// Checks if the user has an active superadmin privilege
export function canSuperAdmin(req: Request): AuthenticationStatus {
  // Check user is logged in
  const status = loggedIn(req);
  if (status != AuthenticationStatus.LOGGED_IN) {
    return status;
  } else if (req.user?.hasRole("superadmin")) {
    return AuthenticationStatus.LOGGED_IN;
  }
  return AuthenticationStatus.NOT_ADMIN;
}

export function handleNotAuthed(
  status: AuthenticationStatus,
  req: Request,
  res: Response
): void {
  const nextUrl = req.method === "GET" ? getNextParam(req.originalUrl) : "";

  switch (status) {
    case AuthenticationStatus.REQUIRES_2FA:
      res.redirect("/otp" + nextUrl);
      return;
    default:
      req.flash("error", "login-required");
      res.redirect("/login" + nextUrl);
      return;
  }
}
// Checks password meets requirements
export function passwordRequirements(password: string): string | true {
  if (!password) return "password-err-length";

  if (password.length < 8) return "password-err-length";

  if (password.match(/\d/g) === null) return "password-err-number";

  if (password.match(/[A-Z]/g) === null) return "password-err-letter-up";

  if (password.match(/[a-z]/g) === null) return "password-err-letter-low";

  return true;
}
