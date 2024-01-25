import axios from "axios";
import { Server } from "node:http";
import { EventEmitter } from "node:events";
import { sign, verify, JsonWebTokenError } from "jsonwebtoken";
import express, { Request, Response } from "express";
import config from "@config";
import { log as mainLogger } from "@core/logging";
import { wrapAsync } from "@core/utils";
import { extractToken } from "@core/utils/auth";

import type { NetworkServiceMap } from "@type/network-service-map";

const log = mainLogger.child({ app: "network-communicator-service" });

class NetworkCommunicatorService {
  private server?: Server;
  private events = new EventEmitter();

  // TODO: remove hardcoded service references
  private services: NetworkServiceMap = {
    app: {},
    api_app: {},
    webhook_app: {},
    telegram_bot: { optional: true }
  };

  /**
   * Sign a internal service request
   * @param payload
   * @returns
   */
  private sign(payload: string | Buffer | object = {}) {
    if (!config.serviceSecret) {
      throw new Error("No service secret found");
    }
    return sign(payload, config.serviceSecret, { algorithm: "HS256" });
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

    // Register internal service routes
    internalApp.post(
      "/reload",
      wrapAsync(this.onInternalServiceRequest.bind(this))
    );

    return internalApp;
  }

  /**
   * Called if this service is notified from other internal service to a registered route
   * * Verifies the request token
   * * If the request is authenticated, it will emit the event with the payload
   * @throws JsonWebTokenError if the request is not authenticated
   * @emits The event with the payload, e.g. "user:created" if the route is "/user/created" or 'reload' if the route is '/reload'
   * @param req
   * @param res
   */
  private async onInternalServiceRequest(req: Request, res: Response) {
    // Get the action from request path
    const actionPath = req.path.substring(1);
    // Convert action path to event name
    const eventName = actionPath.replaceAll("/", ":");
    try {
      const payload = this.verify(req.headers?.authorization);
      this.events.emit(eventName, payload);
      return res.sendStatus(200);
    } catch (error) {
      if (error instanceof JsonWebTokenError) {
        // Not authenticated internal service request
        return res.sendStatus(401);
      } else {
        throw error;
      }
    }
  }

  /**
   * Notify an internal service
   * @param serviceName The name of the service
   * @param actionPath The path of the action
   * @param data The data to send
   * @returns
   */
  private async notify(
    serviceName: string,
    actionPath: string,
    payload: string | Buffer | object = {}
  ) {
    const service = this.services[serviceName];
    if (!service) {
      throw new Error(`Internal service "${serviceName}" not found`);
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.sign(payload)}`
    };

    try {
      // Payload parameter is undefined here because the payload is encrypted in the bearer token
      return await axios.post(
        `http://${serviceName}:4000/${actionPath}`,
        undefined,
        {
          headers
        }
      );
    } catch (error) {
      // If the service is optional and the request fails, ignore the error otherwise log it
      if (!service.optional) {
        log.error("Failed to notify webhook of options change", error);
      }
    }
  }

  /**
   * Notify all internal services
   * @param actionPath The action path, atm only `reload` is used
   */
  public async notifyAll(
    actionPath: string,
    payload?: string | Buffer | object
  ) {
    try {
      for (const serviceName in this.services) {
        await this.notify(serviceName, actionPath, payload);
      }
    } catch (error) {

    }
  }
}

export default new NetworkCommunicatorService();
