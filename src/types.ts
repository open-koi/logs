type CallbackFunction = () => void;

export interface ExpressApp {
  use: CallbackFunction;
  get: CallbackFunction;
}

export interface RawLogs {
  address: string;
  user: string;
  date: string;
  method: string;
  uniqueId: string;
  url: string;
  ref: string;
  proof: any;
}

export interface FormattedLogs {
  addresses: string[];
  url: string;
  proofs: any[];
}

export interface FormattedLogsArray extends Array<FormattedLogs> {
  [key: string]: any;
}

export interface koiLoggerInterface {
  fileDIR: string;
  logFileLocation: string;
  rawLogFileLocation: string;
  proofFileLocation: string;
  node_id: string;
}
