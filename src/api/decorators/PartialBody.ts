import { Body } from "routing-controllers";

export default () => Body({ validate: { skipMissingProperties: true } });
