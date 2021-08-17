import crypto from "crypto";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import base32 from "thirty-two";

import { getNextParam } from "@core/utils";

import Member from "@models/Member";
import { PermissionType } from "@models/MemberPermission";
import Password from "@models/Password";

import config from "@config";

export function generateJWTToken(member: Member): string {
  return jwt.sign({ memberId: member.id }, config.secret);
}

export function parseJWTToken(token: string): string {
  const { memberId } = jwt.verify(token, config.secret) as { memberId: string };
  return memberId;
}

export enum AuthenticationStatus {
  LOGGED_IN = 1,
  NOT_LOGGED_IN = 0,
  NOT_MEMBER = -1,
  NOT_ADMIN = -2,
  REQUIRES_2FA = -3
}

// Used for generating an OTP secret for 2FA
// returns a base32 encoded string of random bytes
export function generateOTPSecret(): Promise<string> {
  return new Promise((resolve) => {
    crypto.randomBytes(16, function (ex, raw) {
      const secret = base32.encode(raw);
      resolve(secret.toString().replace(/=/g, ""));
    });
  });
}

export function generateCode(): string {
  return crypto.randomBytes(10).toString("hex");
}

// Used to create a long salt for each individual user
// returns a 256 byte / 512 character hex string
export function generateSalt(): Promise<string> {
  return new Promise((resolve) => {
    crypto.randomBytes(256, function (ex, salt) {
      resolve(salt.toString("hex"));
    });
  });
}

// Hashes passwords through sha512 1000 times
// returns a 512 byte / 1024 character hex string
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

// Utility function generates a salt and hash from a plain text password
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

// Checks if the user has an active admin or superadmin privilage
export function canAdmin(req: Request): AuthenticationStatus {
  // Check user is logged in
  const status = loggedIn(req);
  if (status != AuthenticationStatus.LOGGED_IN) {
    return status;
  } else if (req.user?.hasPermission("admin")) {
    return AuthenticationStatus.LOGGED_IN;
  }
  return AuthenticationStatus.NOT_ADMIN;
}

// Checks if the user has an active superadmin privilage
export function canSuperAdmin(req: Request): AuthenticationStatus {
  // Check user is logged in
  const status = loggedIn(req);
  if (status != AuthenticationStatus.LOGGED_IN) {
    return status;
  } else if (req.user?.hasPermission("superadmin")) {
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
