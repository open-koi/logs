import * as fs from "fs";
import { open, writeFile } from "fs/promises";
import { Request, Response, RequestHandler, NextFunction } from "express";
import { sha256 } from "js-sha256";
import cryptoRandomString = require("crypto-random-string");
import cron from "node-cron";
import tmp from "tmp";
import crypto = require("crypto");
// import koi from 'koi_tools';
// TODO - fix wallet generation and signing using a seed phrase tmp wallet
import { RawLogs, FormattedLogsArray } from "./types";

// import * as e from "express";
// import { raw } from "express";

// eslint-disable-next-line
const tools = require("@_koi/sdk/web");
const koi = new tools.Web();

const cronstring = "0 0 0 * * *";
const version = "1.0.3";
let _this: koiLogs;

class koiLogs {
  constructor(path: string) {
    if (path) {
      this.fileDIR = path;
    }
    this.logFileLocation = "";
    this.rawLogFileLocation = "";
    this.proofFileLocation = "";
    this.generateLogFiles();
    this.node_id = getLogSalt();
  }

  logFileLocation: string;
  rawLogFileLocation: string;
  proofFileLocation: string;
  fileDIR: any;
  node_id: string;
  middleware: any;

  private async generateLogFiles(): Promise<any> {
    // create three files (access.log, daily.log, and proofs.log) with names corresponding to the date
    const date = new Date();
    const names = [
      date.toISOString().slice(0, 10) + "-daily.log",
      date.toISOString().slice(0, 10) + "-access.log",
      date.toISOString().slice(0, 10) + "-proofs.log"
    ];

    const paths: string[] = [];
    for (const name of names) {
      const path = (await this.createLogFile(name)) as string;
      paths.push(path);
    }

    // console.log('created paths', paths, paths[0])

    // set the log file names in global vars
    // sloppy, needs to move to cleaner OOP
    this.logFileLocation = paths[0];

    this.rawLogFileLocation = paths[1];

    this.proofFileLocation = paths[2];
    this.koiLogsDailyTask();
    // return their file names to the caller
    return paths;
  }

  public logger: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    if (!this.rawLogFileLocation) {
      await this.rawLogFileLocation;
    }
    const payload: any = {
      address: req.ip,
      date: new Date(),
      method: req.method,
      url: req.path,
      type: req.protocol,
      proof: {
        signature: req.headers["x-request-signature"],
        public_key: req.headers["request-public-key"],
        network: req.headers["Network-Type"]
      }
    };
    console.log(this.rawLogFileLocation);
    if (payload.proof.signature) {
      const dataAndSignature = JSON.parse(payload.proof.signature);
      const valid = await koi.verifySignature({
        ...dataAndSignature,
        owner: payload.proof.public_key
      });
      if (!valid) {
        console.log("Signature verification failed");
        return next();
      }
      const signatureHash = crypto
        .createHash("sha256")
        .update(JSON.stringify(dataAndSignature.signature))
        .digest("hex");
      if (!this.difficultyFunction(signatureHash)) {
        console.log("Signature hash incorrect");
        return next();
      }
    }
    fs.appendFile(
      this.rawLogFileLocation,
      JSON.stringify(payload) + "\r\n",
      function (err) {
        if (err) throw err;
      }
    );
    return next();
  };

  difficultyFunction(hash: string) {
    return hash.startsWith("00") || hash.startsWith("01");
  }

  async koiLogsHelper(req: Request, res: Response) {
    const logLocation = this.logFileLocation as string;
    // console.log('entered koiLogsHelper at ', new Date(), !this, logLocation)
    if (logLocation === "") await this.generateLogFiles();
    fs.readFile(logLocation, "utf8", (err: any, data: any) => {
      if (err) {
        // console.error(err)
        // console.log('sent err ', err, new Date());
        return res.status(500).send(err);
      }
      // console.log('sent data ', data, new Date());
      return res.status(200).send(data);
    });
  }

  async info(req: Request, res: Response) {
    return res.status(200).send({
      node: this.node_id,
      version: version,
      timer: cronstring
    });
  }

  async koiRawLogsHelper(req: Request, res: Response) {
    const logLocation = this.rawLogFileLocation as string;
    // console.log('entered koiRawLogsHelper at ', new Date(), !this, logLocation)
    if (logLocation === "") await this.generateLogFiles();
    fs.readFile(logLocation, "utf8", (err: any, data: any) => {
      if (err) {
        // console.error(err)
        res.status(500).send(err);
        return;
      }
      res.status(200).send(data);
    });
  }

  // Todo, replace this with setInterval
  async koiLogsDailyTask(): Promise<any> {
    _this = this;
    _this.logsTask();
    return cron.schedule(cronstring, async function () {
      // console.log('running the log cleanup task once per day on ', new Date());
      const result = await _this.logsTask();
      // console.log('daily log task returned ', result)
    });
  }

  private async logsTask(): Promise<any> {
    const masterSalt = getLogSalt();

    // then get the raw logs
    const rawLogs = (await this.readRawLogs(masterSalt)) as RawLogs[];

    const sorted = (await sortAndFilterLogs(rawLogs)) as FormattedLogsArray;

    const result = await this.writeDailyLogs(sorted);

    // last, clear old logs
    await this.clearRawLogs();
    return result;
  }

  /*
    @clearRawLogs
      removes the old access logs file
  */
  private async clearRawLogs(): Promise<any> {
    const fileHandle = await open(this.rawLogFileLocation, "r+");
    await fileHandle.truncate(0);
  }

  /*
    @readRawLogs
      retrieves the raw logs and reads them into a json array
  */
  private async readRawLogs(masterSalt: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const fullLogs = fs.readFileSync(this.rawLogFileLocation);
      const logs = fullLogs.toString().split("\n");
      // console.log('logs are', logs)
      const prettyLogs = [] as RawLogs[];
      for (const log of logs) {
        // console.log('log is', log)
        try {
          if (log && !(log === " ") && !(log === "")) {
            try {
              const logJSON = JSON.parse(log) as RawLogs;
              // console.log('logJSON is', logJSON)
              logJSON.uniqueId = sha256(logJSON.url);
              logJSON.address = sha256.hmac(masterSalt, logJSON.address);
              prettyLogs.push(logJSON);
            } catch (err) {
              // console.error('error reading json in Koi log middleware', err)
              // reject(err)
            }
          }
        } catch (err) {
          // console.error('err', err)
          // reject(err)
        }
      }
      // console.log('resolving some prettyLogs ('+ prettyLogs.length +') sample:', prettyLogs[prettyLogs.length - 1])
      resolve(prettyLogs);
    });
  }

  /*
    @writeDailyLogs
      generates the daily log file (/logs/)
  */
  private async writeDailyLogs(logs: FormattedLogsArray): Promise<any> {
    // generate the log payload
    const data = {
      gateway: this.node_id,
      lastUpdate: new Date(),
      summary: [] as any[],
      signature: "",
      version: version
    };

    // sign it
    data.signature = signLogs(data);
    for (const key in logs) {
      const log = logs[key];
      if (log && log.addresses) {
        data.summary.push(log);
      }
    }

    try {
      await writeFile(this.logFileLocation, JSON.stringify(data));
      return { success: true, logs: data };
    } catch (err) {
      return { success: false, logs: data, error: err };
    }
  }

  /*
    generate the log files
  */
  private async createLogFile(name: string): Promise<any> {
    // resolve('/tmp/' + name as string)
    if (this.fileDIR > "") {
      const fileName = this.fileDIR + name;
      try {
        await writeEmptyFile(fileName);
        return fileName;
      } catch (err) {
        throw Error("error writing log file " + fileName);
      }
    }

    new Promise((resolve, reject) => {
      tmp.file(function _tempFileCreated(err, path: string, _fd) {
        if (err) reject(err);
        resolve(path);
      });
    });
  }
}

export = koiLogs;

//////////////////////// Utility Functions //////////////////////////////
/*
  generates and returns a signature for a koi logs payload
*/
function signLogs(data: any) {
  // TODO - replace with koi.sign and ensure a seed phrase is saved by end user somehow
  return sha256(cryptoRandomString({ length: 10 })); // TODO
}

/*
  @sortAndFilterLogs
    logs - access.log output (raw data in array)
    resolves to an array of data payloads
*/
async function sortAndFilterLogs(logs: RawLogs[]) {
  const formatted_logs = [] as FormattedLogsArray;

  for (const log of logs) {
    if (log.url && log.uniqueId) {
      if (!log.proof) log.proof = {} as any;
      if (!formatted_logs[log.uniqueId]) {
        formatted_logs[log.uniqueId] = {
          addresses: [log.address],
          url: log.url,
          proofs: [log.proof]
        };
      } else {
        if (!formatted_logs[log.uniqueId].addresses.includes(log.address)) {
          formatted_logs[log.uniqueId].addresses.push(log.address);
          formatted_logs[log.uniqueId].proofs.push(log.proof);
        }
      }
    }
  }
  // console.log('about to resolve formattedlogs', formatted_logs.length, 'sample:', formatted_logs[formatted_logs.length - 1])
  return formatted_logs;
}

async function writeEmptyFile(location: string) {
  try {
    const result = await writeFile(location, "");
    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

function getLogSalt() {
  return sha256(cryptoRandomString({ length: 10 }));
}
