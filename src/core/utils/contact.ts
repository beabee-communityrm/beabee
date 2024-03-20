import { Request, Response } from "express";

import Contact from "#models/Contact";

export function loginAndRedirect(
  req: Request,
  res: Response,
  contact: Contact,
  url?: string
): void {
  req.login(contact as Express.User, function (loginError) {
    if (loginError) {
      throw loginError;
    } else {
      res.redirect(url || "/");
    }
  });
}

export function generateContactCode(contact: Partial<Contact>): string | null {
  if (contact.firstname && contact.lastname) {
    const no = ("000" + Math.floor(Math.random() * 1000)).slice(-3);
    return (contact.firstname[0] + contact.lastname[0] + no).toUpperCase();
  }
  return null;
}
