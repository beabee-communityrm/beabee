import axios from "axios";
import { Server } from "node:http";
import { EventEmitter } from "node:events";
import { sign, verify, JsonWebTokenError } from "jsonwebtoken";
import express, { Express } from "express";
import config from "@config";
import { log as mainLogger } from "@core/logging";
import { wrapAsync } from "@core/utils";
import { extractToken } from "@core/utils/auth";

const log = mainLogger.child({ app: "network-communicator-service" });

class NetworkCommunicatorService {
  private server?: Server;
  private events = new EventEmitter();

  /**
   * Sign a internal service request
   * @param payload
   * @returns
   */
  private sign(payload: string | Buffer | object = {}) {
    return sign(payload, config.secret, { algorithm: "HS256" });
  }

  /**
   * Verify a internal service request
   * @param token
   * @returns the payload decoded if the signature is valid and optional expiration, audience, or issuer are valid. If not valid, it will return the JsonWebTokenError.
   */
  private verify(authHeader?: string) {
    const token = extractToken(authHeader);
    if (!token) {
      return new JsonWebTokenError("No token found");
    }
    try {
      return verify(token, config.secret);
    } catch (error) {
      if (error instanceof JsonWebTokenError) {
        return error;
      } else {
        throw error;
      }
    }
  }

  // Event methods
  public on = this.events.on;
  public once = this.events.once;
  public off = this.events.off;

  /**
   * Start the internal server
   * @param app
   * @returns
   */
  public startServer(app: Express) {
    const internalApp = express();
    this.server = internalApp.listen(4000);

    process.on("SIGTERM", () => {
      this.server?.close();
    });

    internalApp.post(
      "/reload",
      wrapAsync(async (req, res) => {
        const payloadOrError = this.verify(req.headers?.authorization);
        if (payloadOrError instanceof JsonWebTokenError) {
          // Not authenticated internal service request
          return res.sendStatus(401);
        }
        this.events.emit("reload", payloadOrError);
        res.sendStatus(200);
      })
    );

    return internalApp;
  }

  /**
   * Notify other internal services of options change.
   */
  public async notify() {
    const data = {
      Headers: {
        Authorization: `Bearer ${this.sign()}`
      }
    };
    try {
      // TODO: remove hardcoded service references
      await axios.post("http://app:4000/reload", data);
      await axios.post("http://api_app:4000/reload", data);
      await axios.post("http://webhook_api_app:4000/reload", data);
      await axios.post("http://webhook_app:4000/reload", data);
      await axios.post("http://telegram_bot:4000/reload", data);
    } catch (error) {
      log.error("Failed to notify webhook of options change", error);
    }
  }
}

export default new NetworkCommunicatorService();
