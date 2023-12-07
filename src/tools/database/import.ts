import "module-alias/register";

import readline from "readline";

import { dataSource } from "@core/database";
import { runApp } from "@core/server";

import config from "@config";

if (!config.dev) {
  console.error("Can't import to live database");
  process.exit(1);
}

runApp(async () => {
  // File format: first line is SQL, second is params (repeated)
  try {
    await dataSource.manager.transaction(async (manager) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
      });

      let query = "";
      for await (const line of rl) {
        if (query) {
          console.log("Running " + query.substring(0, 100) + "...");
          await manager.query(
            query,
            line !== "" ? JSON.parse(line) : undefined
          );
          query = "";
        } else {
          query = line;
        }
      }
    });
  } catch (err) {
    console.error(err);
  }
});
