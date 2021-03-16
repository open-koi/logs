interface ExpressApp {
    use: Function;
    get: Function;
}
interface RawLogs {
    address: string;
    user: string;
    date: string;
    method: string;
    uniqueId: string;
    url: string;
    ref: string;
}
interface FormattedLogs {
    addresses: string[];
    url: string;
}
interface FormattedLogsArray extends Array<FormattedLogs> {
    [key: string]: any;
}
interface koiLoggerInterface {
    fileDIR: string;
    logFileLocation: string;
    rawLogFileLocation: string;
    proofFileLocation: string;
    node_id: string;
}
