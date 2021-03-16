
export interface ExpressApp {
  use: Function,
  get: Function
}

export interface RawLogs {
  address: string,
  user: string,
  date: string,
  method: string,
  uniqueId: string,
  url: string,
  ref: string,
}

export interface FormattedLogs {
  addresses: string[],
  url: string
}

export interface FormattedLogsArray extends Array<FormattedLogs> {
  [key: string]: any
}

export interface koiLoggerInterface {
  fileDIR: string,
  logFileLocation: string,
  rawLogFileLocation: string,
  proofFileLocation: string,
  node_id: string,
}