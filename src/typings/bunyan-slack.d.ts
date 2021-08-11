declare module "bunyan-slack" {
  import { WriteStream } from "fs";
  import { LogLevelString } from "bunyan";

  interface Record {
    msg: string;
    error?: {
      message: string;
      stack: string;
    };
  }

  interface SlackMessage {
    text: string;
    attachments?: {
      title: string;
      text: string;
    }[];
  }

  interface BunyanSlackOptions {
    level: LogLevelString;
    webhook_url: string;
    channel: string;
    username: string;
    customFormatter(record: Record, level: LogLevelString): SlackMessage;
  }

  export default class BunyanSlack extends WriteStream {
    constructor(opts: BunyanSlackOptions);
  }
}
