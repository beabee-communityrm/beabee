import Member from "@models/Member";
import { Request } from "express";

export function login(req: Request, member: Member): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    req.login(member, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
