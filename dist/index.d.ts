import { Request, Response } from 'express';
export default class koiLogs {
    constructor(path: string);
    logFileLocation: string;
    rawLogFileLocation: string;
    proofFileLocation: string;
    fileDIR: any;
    node_id: string;
    middleware: object;
    private generateLogFiles;
    koiLogsHelper(req: Request, res: Response): Promise<any>;
    koiRawLogsHelper(req: Request, res: Response): Promise<any>;
    private koiLogsDailyTask;
    private logsTask;
    private clearRawLogs;
    private readRawLogs;
    private writeDailyLogs;
    private createLogFile;
}
