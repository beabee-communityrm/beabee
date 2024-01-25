export interface NetworkService {
  /** The host URL of the network service. */
  host: string;
  /** If true network errors are ignored. */
  optional?: boolean;
}
