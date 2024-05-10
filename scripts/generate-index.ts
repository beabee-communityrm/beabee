// Simple script to generate index.ts files for each folder listed in the paths array

const PATHS = [
  "./src/api/controllers",
  "./src/api/decorators",
  "./src/api/dto",
  "./src/api/errors",
  "./src/api/interceptors",
  "./src/api/middlewares",
  "./src/api/params",
  "./src/api/transformers",
  "./src/api/utils",
  "./src/api/validators",
  "./src/enums",
  "./src/models",
  "./src/type"
];

import { readdirSync, writeFileSync } from "fs";

const encoder = new TextEncoder();

const generateIndex = (paths: string[]) => {
  for (const path of paths) {
    const files = readdirSync(path);
    // Sort files by file name
    files.sort((a, b) => a.localeCompare(b));

    let indexContent = "";

    for (const file of files) {
      if (file.endsWith(".ts") && file !== "index.ts") {
        indexContent += `export * from "./${file.split(".")[0]}.js";\n`;
      }
    }

    writeFileSync(`${path}/index.ts`, encoder.encode(indexContent));
  }
};

generateIndex(PATHS);
