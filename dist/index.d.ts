import { Request, Response } from 'express';
export default class koiLogs {
    constructor(path: string);
    logFileLocation: string;
    rawLogFileLocation: string;
    proofFileLocation: string;
    fileDIR: any;
    node_id: string;
    middleware: any;
    private generateLogFiles;
    generateMiddleware(): Promise<any>;
    koiLogsHelper(req: Request, res: Response): Promise<void>;
    koiRawLogsHelper(req: Request, res: Response): Promise<void>;
    koiLogsDailyTask(): Promise<any>;
    private logsTask;
    private clearRawLogs;
    private readRawLogs;
    private writeDailyLogs;
    private createLogFile;
}
