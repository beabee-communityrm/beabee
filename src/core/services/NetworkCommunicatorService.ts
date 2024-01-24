import axios from "axios";
import { sign, verify } from "jsonwebtoken";
import { Server } from "http";
import express, { Express } from "express";
import config from "@config";
import { log as mainLogger } from "@core/logging";
import OptionsService from "@core/services/OptionsService";
import { wrapAsync } from "@core/utils";

const log = mainLogger.child({ app: "network-communicator-service" });

class NetworkCommunicatorService {

    private server?: Server

    /**
     * Sign a internal service request
     * @param payload 
     * @returns 
     */
    private sign(payload: string | Buffer | object) {
        return sign(payload, config.secret, { algorithm: 'HS256' });
    }

    /**
     * Verify a internal service request
     * @param token 
     * @returns 
     */
    private verify(token: string) {
        return verify(token, config.secret);
    }

    public startServer(app: Express) {
        const internalApp = express();
        this.server = internalApp.listen(4000);

        process.on("SIGTERM", () => {
            this.server?.close();
        });

        internalApp.post(
            "/reload",
            wrapAsync(async (req, res) => {
                if (!req.headers.authorization || !this.verify(req.headers.authorization)) {
                    // Not authenticated internal service request
                    return res.sendStatus(401);
                }
                await OptionsService.reload();
                res.sendStatus(200);
            })
        );

        return internalApp;
    }

    /**
     * Notify other internal services of options change.
     */
    public async notify() {
        try {
            // TODO: remove hardcoded service references
            await axios.post("http://app:4000/reload", {
                Headers: {
                    Authorization: `Bearer ${this.sign({
                        service: "app",
                        action: "reload",
                    })}`,
                }
            });
            await axios.post("http://api_app:4000/reload", {
                Headers: {
                    Authorization: `Bearer ${this.sign({
                        service: "api_app",
                        action: "reload",
                    })}`,
                }
            });
            await axios.post("http://webhook_api_app:4000/reload", {
                Headers: {
                    Authorization: `Bearer ${this.sign({
                        service: "webhook_api_app",
                        action: "reload",
                    })}`,
                }
            });
            await axios.post("http://webhook_app:4000/reload", {
                Headers: {
                    Authorization: `Bearer ${this.sign({
                        service: "webhook_app",
                        action: "reload",
                    })}`,
                }
            });
            await axios.post("http://telegram_bot:4000/reload", {
                Headers: {
                    Authorization: `Bearer ${this.sign({
                        service: "telegram_bot",
                        action: "reload",
                    })}`,
                }
            });
        } catch (error) {
            log.error("Failed to notify webhook of options change", error);
        }
    }
}

export default new NetworkCommunicatorService();