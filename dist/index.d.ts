import { Request, Response, RequestHandler } from 'express';
declare class koiLogs {
    constructor(path: string);
    logFileLocation: string;
    rawLogFileLocation: string;
    proofFileLocation: string;
    fileDIR: any;
    node_id: string;
    middleware: any;
    private generateLogFiles;
    logger: RequestHandler;
    koiLogsHelper(req: Request, res: Response): Promise<void>;
    info(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    koiRawLogsHelper(req: Request, res: Response): Promise<void>;
    koiLogsDailyTask(): Promise<any>;
    private logsTask;
    private clearRawLogs;
    private readRawLogs;
    private writeDailyLogs;
    private createLogFile;
}
export = koiLogs;
