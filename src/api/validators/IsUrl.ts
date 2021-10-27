import { IsUrl } from "class-validator";

// Allow localhost, this should possibly only be enabled on dev?
export default () => IsUrl({ require_tld: false });
