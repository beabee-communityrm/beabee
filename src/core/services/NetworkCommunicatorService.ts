import axios from "axios";
import { Server } from "node:http";
import { EventEmitter } from "node:events";
import { sign, verify, JsonWebTokenError } from "jsonwebtoken";
import express from "express";
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
   * @returns The payload decoded if the signature is valid and optional expiration, audience, or issuer are valid.
   * @throws If not valid, it will throw the `JsonWebTokenError`.
   */
  private verify(authHeader?: string) {
    const token = extractToken(authHeader);
    if (!token) {
      throw new JsonWebTokenError("No token found");
    }
    return verify(token, config.secret);
  }

  /**
   * Send a post request to an internal service
   * @param serviceName The name of the service
   * @param actionPath The path of the action
   * @param data The data to send
   * @returns
   */
  private async post(serviceName: string, actionPath: string, data?: any) {
    try {
      return await axios.post(`http://${serviceName}:4000/${actionPath}`, data);
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        log.warn(`Internal service "${serviceName}" not found`, error);
        return;
      } else {
        throw error;
      }
    }
  }

  /**
   * Send a post request to multiple internal services
   * @param serviceNames The service names
   * @param actionPath The path of the action
   * @param data The data to send
   */
  private async posts(serviceNames: string[], actionPath: string, data?: any) {
    for (const serviceName of serviceNames) {
      await this.post(serviceName, actionPath, data);
    }
  }

  // Event methods
  public on = this.events.on;
  public once = this.events.once;
  public off = this.events.off;

  /**
   * Start the internal server
   */
  public startServer() {
    const internalApp = express();
    this.server = internalApp.listen(4000);

    process.on("SIGTERM", () => {
      this.server?.close();
    });

    internalApp.post(
      "/reload",
      wrapAsync(async (req, res) => {
        try {
          const payload = this.verify(req.headers?.authorization);
          this.events.emit("reload", payload);
          res.sendStatus(200);
        } catch (error) {
          if (error instanceof JsonWebTokenError) {
            // Not authenticated internal service request
            return res.sendStatus(401);
          } else {
            throw error;
          }
        }
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
      const actionPath = "reload";
      await this.posts(
        ["app", "api_app", "webhook_app", "telegram_bot"],
        actionPath,
        data
      );
    } catch (error) {
      log.error("Failed to notify webhook of options change", error);
    }
  }
}

export default new NetworkCommunicatorService();
