import fs from "fs";
import dot from "dot";
import express from "express";
import moment from "moment";

import config, {
  AppConfig,
  AppConfigOverride,
  AppConfigOverrides
} from "@config";

import { log as mainLogger } from "@core/logging";
import templateLocals from "@core/template-locals";

let git = "";
try {
  git = fs.readFileSync(__dirname + "/../revision.txt").toString();
} catch (e) {
  git = "DEV";
}

const log = mainLogger.child({ app: "app-loader" });

async function loadAppConfigs(
  basePath: string,
  overrides: AppConfigOverrides = {}
): Promise<AppConfig[]> {
  const appConfigs = fs
    .readdirSync(basePath)
    .filter((appDir) => {
      const path = basePath + "/" + appDir;
      return (
        fs.statSync(path).isDirectory() && fs.existsSync(path + "/config.json")
      );
    })
    .map((appDir) =>
      loadAppConfig(appDir, basePath + "/" + appDir, overrides[appDir])
    );

  return (await Promise.all(appConfigs))
    .filter((appConfig) => !appConfig.disabled)
    .sort((a, b) => b.priority - a.priority);
}

async function loadAppConfig(
  uid: string,
  path: string,
  overrides: AppConfigOverride = {}
): Promise<AppConfig> {
  const appConfig = (
    await import(path + "/config.json", {
      assert: { type: "json" }
    })
  ).default;

  const subApps = fs.existsSync(path + "/apps")
    ? await loadAppConfigs(path + "/apps", overrides.subApps)
    : [];

  return {
    uid,
    appPath: path + "/app.js",
    priority: 100,
    menu: "none",
    permissions: [],
    subApps,
    ...appConfig,
    ...overrides.config
  };
}

async function requireApp(appPath: string): Promise<express.Express> {
  const app = await import(appPath);
  return app.default.default || app.default;
}

async function routeApps(
  parentApp: express.Express,
  appConfigs: AppConfig[],
  depth = 0
) {
  for (const appConfig of appConfigs) {
    log.info(`Loading app ${"..".repeat(depth)}${appConfig.path}`);

    const app = await requireApp(appConfig.appPath);

    // For pug templates
    app.locals.basedir = __dirname + "/..";

    // Global locals
    app.locals.git = git;
    app.locals.audience = config.audience;
    app.locals.currencySymbol = config.currencySymbol;
    app.locals.dev = config.dev;

    // Global libraries
    app.locals.moment = moment;
    app.locals.dot = dot;

    parentApp.use(
      "/" + appConfig.path,
      (req, res, next) => {
        res.locals.app = appConfig;
        // Bit of a hack to pass all params everywhere
        req.allParams = { ...req.allParams, ...req.params };
        next();
      },
      app
    );

    if (appConfig.subApps.length > 0) {
      await routeApps(app, appConfig.subApps, depth + 1);
    }
  }
}

export default async function (app: express.Express): Promise<void> {
  const appConfigs = await loadAppConfigs(
    __dirname + "/../apps",
    config.appOverrides
  );
  app.use(templateLocals(appConfigs));
  await routeApps(app, appConfigs);
}
