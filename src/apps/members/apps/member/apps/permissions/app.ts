import { PermissionType } from "@beabee/beabee-common";
import express, { NextFunction, Request, Response } from "express";

import { hasSchema } from "@core/middleware";
import { createDateTime, wrapAsync } from "@core/utils";

import ContactsService from "@core/services/ContactsService";

import Contact from "@models/Contact";

import { createPermissionSchema, updatePermissionSchema } from "./schemas.json";

interface CreatePermissionSchema {
  permission: PermissionType;
  startTime: string;
  startDate: string;
  expiryDate?: string;
  expiryTime?: string;
}

function hasPermission(member: Contact, permission: PermissionType) {
  return permission !== "superadmin" || member.hasPermission("superadmin");
}

function canUpdatePermission(req: Request, res: Response, next: NextFunction) {
  if (hasPermission(req.user!, req.params.id as PermissionType)) {
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
    const { permission, startTime, startDate, expiryDate, expiryTime } =
      req.body as CreatePermissionSchema;
    const member = req.model as Contact;

    if (!hasPermission(req.user!, permission)) {
      req.flash("danger", "403");
      return res.redirect(req.originalUrl);
    }

    const dupe = member.permissions.find((p) => p.permission === permission);
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

    await ContactsService.updateContactRole(member, permission, {
      dateAdded,
      dateExpires
    });

    res.redirect(req.originalUrl);
  })
);

app.get(
  "/:id/modify",
  canUpdatePermission,
  wrapAsync(async (req, res) => {
    const member = req.model as Contact;

    const permission = member.permissions.find(
      (p) => p.permission === req.params.id
    );
    if (permission) {
      res.render("permission", { member, current: permission });
    } else {
      req.flash("warning", "permission-404");
      res.redirect(req.baseUrl);
    }
  })
);

app.post(
  "/:id/modify",
  canUpdatePermission,
  hasSchema(updatePermissionSchema).orFlash,
  wrapAsync(async (req, res) => {
    const {
      body: { startDate, startTime, expiryDate, expiryTime }
    } = req;
    const member = req.model as Contact;
    const permission = req.params.id as PermissionType;

    const dateAdded = createDateTime(startDate, startTime);
    const dateExpires = createDateTime(expiryDate, expiryTime);

    if (dateExpires && dateAdded >= dateExpires) {
      req.flash("warning", "permission-expiry-error");
      res.redirect(req.baseUrl);
      return;
    }

    await ContactsService.updateContactRole(member, permission, {
      dateAdded,
      dateExpires
    });

    req.flash("success", "permission-updated");
    res.redirect(req.baseUrl);
  })
);

app.post(
  "/:id/revoke",
  canUpdatePermission,
  wrapAsync(async (req, res) => {
    await ContactsService.revokeContactRole(
      req.model as Contact,
      req.params.id as PermissionType
    );

    req.flash("success", "permission-removed");
    res.redirect(req.baseUrl);
  })
);

export default app;
