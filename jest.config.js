/** @type {import('ts-jest').JestConfigWithTsJest} */
const { pathsToModuleNameMapper } = require("ts-jest");
const tsconfig = require("tsconfig");

const { config } = tsconfig.loadSync(__dirname);

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: pathsToModuleNameMapper(config.compilerOptions.paths, {
    prefix: "<rootDir>"
  })
};
