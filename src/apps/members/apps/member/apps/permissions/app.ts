import { RoleType } from "@beabee/beabee-common";
import express, { NextFunction, Request, Response } from "express";

import { hasSchema } from "#core/middleware";
import { createDateTime, wrapAsync } from "#core/utils";

import ContactsService from "#core/services/ContactsService";

import Contact from "#models/Contact";

import { createPermissionSchema, updatePermissionSchema } from "./schemas.json";

interface CreateRoleSchema {
  type: RoleType;
  startTime: string;
  startDate: string;
  expiryDate?: string;
  expiryTime?: string;
}

function canUpdateRole(req: Request, res: Response, next: NextFunction) {
  if (req.user?.hasRole(req.params.id as RoleType)) {
    next();
  } else {
    req.flash("danger", "403");
    res.redirect(req.originalUrl);
  }
}

const app = express();

app.set("views", __dirname + "/views");

app.get(
  "/",
  wrapAsync(async (req, res) => {
    res.render("index", { member: req.model });
  })
);

app.post(
  "/",
  hasSchema(createPermissionSchema).orFlash,
  wrapAsync(async (req, res) => {
    const { type, startTime, startDate, expiryDate, expiryTime } =
      req.body as CreateRoleSchema;
    const contact = req.model as Contact;

    if (!req.user?.hasRole(type)) {
      req.flash("danger", "403");
      return res.redirect(req.originalUrl);
    }

    const dupe = contact.roles.find((p) => p.type === type);
    if (dupe) {
      req.flash("danger", "permission-duplicate");
      res.redirect(req.originalUrl);
      return;
    }

    const dateAdded = createDateTime(startDate, startTime);
    const dateExpires = createDateTime(expiryDate, expiryTime);

    if (dateExpires && dateAdded >= dateExpires) {
      req.flash("warning", "permission-expiry-error");
      res.redirect(req.originalUrl);
      return;
    }

    await ContactsService.updateContactRole(contact, type, {
      dateAdded,
      dateExpires
    });

    res.redirect(req.originalUrl);
  })
);

app.get(
  "/:id/modify",
  canUpdateRole,
  wrapAsync(async (req, res) => {
    const contact = req.model as Contact;

    const role = contact.roles.find((p) => p.type === req.params.id);
    if (role) {
      res.render("permission", { member: contact, current: role });
    } else {
      req.flash("warning", "permission-404");
      res.redirect(req.baseUrl);
    }
  })
);

app.post(
  "/:id/modify",
  canUpdateRole,
  hasSchema(updatePermissionSchema).orFlash,
  wrapAsync(async (req, res) => {
    const {
      body: { startDate, startTime, expiryDate, expiryTime }
    } = req;
    const contact = req.model as Contact;
    const roleType = req.params.id as RoleType;

    const dateAdded = createDateTime(startDate, startTime);
    const dateExpires = createDateTime(expiryDate, expiryTime);

    if (dateExpires && dateAdded >= dateExpires) {
      req.flash("warning", "permission-expiry-error");
      res.redirect(req.baseUrl);
      return;
    }

    await ContactsService.updateContactRole(contact, roleType, {
      dateAdded,
      dateExpires
    });

    req.flash("success", "permission-updated");
    res.redirect(req.baseUrl);
  })
);

app.post(
  "/:id/revoke",
  canUpdateRole,
  wrapAsync(async (req, res) => {
    await ContactsService.revokeContactRole(
      req.model as Contact,
      req.params.id as RoleType
    );

    req.flash("success", "permission-removed");
    res.redirect(req.baseUrl);
  })
);

export default app;
