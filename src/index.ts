import * as fs from 'fs';
import { Request, Response, RequestHandler, NextFunction } from 'express';
import { sha256 } from 'js-sha256';
import cryptoRandomString = require("crypto-random-string")
import cron from 'node-cron';
import tmp from 'tmp';
let crypto = require("crypto")
// import koi from 'koi_tools';
// TODO - fix wallet generation and signing using a seed phrase tmp wallet
import e = require('express');
// const { koi_tools } = require("koi_tools");
const tools = require("@_koi/sdk/web");
const koi = new tools.Web();
const WALLET_PATH = "../arweave-key-50JVvg84zA2ae-lQ7j9tL_CIXFlNXr2FXjEcDNXfTkc.json";
// const koi = new koi_tools();
import {
  RawLogs,
  FormattedLogsArray
} from './types';
import { raw } from 'express';

const cronstring = '0 0 0 * * *';
const version = '1.0.3';

class koiLogs{
  constructor(path: string) {
    if (path) {
      this.fileDIR = path;
    }
    this.logFileLocation = "";
    this.rawLogFileLocation = "";
    this.proofFileLocation = "";
    this.generateLogFiles()
    this.node_id = getLogSalt()
    
  }

  logFileLocation: string;
  rawLogFileLocation: string;
  proofFileLocation: string;
  fileDIR: any;
  node_id: string;
  middleware: any;

  private async generateLogFiles(): Promise<any> {
    return new Promise(async (resolve, reject) => {
      try {
        // create three files (access.log, daily.log, and proofs.log) with names corresponding to the date
        var date = new Date();
        var names = [
          date.toISOString().slice(0, 10) + '-daily.log',
          date.toISOString().slice(0, 10) + '-access.log',
          date.toISOString().slice(0, 10) + '-proofs.log',
        ]

        let paths: (string)[] = []
        for (var name of names) {
          try {

            var path = await this.createLogFile(name) as string;
            
            paths.push(path)


          } catch (err) {
            reject(err)
          }
        }

        // console.log('created paths', paths, paths[0])

        // set the log file names in global vars
        // sloppy, needs to move to cleaner OOP
        this.logFileLocation = paths[0]

        this.rawLogFileLocation = paths[1]

        this.proofFileLocation = paths[2]
        this.koiLogsDailyTask()
        // return their file names to the caller
        resolve(paths)

      } catch (err) {
        reject(err)
      }
    })
  }
  
  public logger: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    if (!this.rawLogFileLocation) {
      await this.rawLogFileLocation
    }
    var payload = {
      "address": req.ip,
      "date": new Date(),
      "method": req.method,
      "url": req.path,
      "type": req.protocol,
      "proof": {
        "signature" : req.headers['x-request-signature'],
        "public_key": req.headers['request-public-key'],
        "network": req.headers['Network-Type']
      }
    }
    let verificationProof = JSON.parse(payload.proof.signature+"")
    let valid = await koi.verifySignature(verificationProof);
    if(!valid){
      console.log("Signature verification failed")
      return next()
    }
    let signatureHash = crypto.createHash("sha256").update(JSON.stringify(verificationProof.signature)).digest("hex");
    if(!this.difficultyFunction(signatureHash)){
      console.log("Signature hash incorrect")
      return next()
    }
    console.log(this.rawLogFileLocation)
    fs.appendFile(this.rawLogFileLocation, JSON.stringify(payload) + "\r\n", function (err) {
      if (err) throw err;
    });
    return next()
  }

  difficultyFunction(hash:String){
    return hash.startsWith("00")|| hash.startsWith("01")
}

  async koiLogsHelper(req: Request, res: Response) {
    var logLocation = this.logFileLocation as string;
    // console.log('entered koiLogsHelper at ', new Date(), !this, logLocation)
    if ( logLocation === "" )  await this.generateLogFiles()
    fs.readFile(logLocation, 'utf8', (err: any, data: any) => {
      if (err) {
        // console.error(err)
        // console.log('sent err ', err, new Date());
        return res.status(500).send(err);
      }
      // console.log('sent data ', data, new Date());
      return res.status(200).send(data);
    })
  }

  async info(req: Request, res: Response) {
    return res.status(200).send({
      node: this.node_id,
      version: version,
      timer: cronstring
    })
  }

  async koiRawLogsHelper(req: Request, res: Response) {
    var logLocation = this.rawLogFileLocation as string;
    // console.log('entered koiRawLogsHelper at ', new Date(), !this, logLocation)
    if ( logLocation === "" )  await this.generateLogFiles()
    fs.readFile(logLocation, 'utf8', (err: any, data: any) => {
      if (err) {
        // console.error(err)
        res.status(500).send(err);
        return
      }
      res.status(200).send(data);
    })
  }

  async koiLogsDailyTask(): Promise<any> {
    const _this = this;
    _this.logsTask()
    return cron.schedule(cronstring, async function () {
      // console.log('running the log cleanup task once per day on ', new Date());
      let result = await _this.logsTask()
      // console.log('daily log task returned ', result)
    });
  }

  private async logsTask(): Promise<any> {
    return new Promise(async (resolve, reject) => {
      try {
        let masterSalt = getLogSalt()

        // then get the raw logs
        let rawLogs = await this.readRawLogs(masterSalt) as RawLogs[];

        let sorted = await sortAndFilterLogs(rawLogs) as FormattedLogsArray;

        let result = await this.writeDailyLogs(sorted);

        // last, clear old logs
        await this.clearRawLogs();

        resolve(result);

      } catch (err) {
        // console.error('error writing daily log file', err)
        reject(err);
      }
    })
  }

  /*
    @clearRawLogs
      removes the old access logs file
  */
  private async clearRawLogs(): Promise<any> {
    return new Promise((resolve, reject) => {
      fs.truncate(this.rawLogFileLocation, 0, function () {
        resolve(true)
      });
    });
  }

  /*
    @readRawLogs
      retrieves the raw logs and reads them into a json array
  */
  private async readRawLogs(masterSalt: string): Promise<any> {
    return new Promise((resolve, reject) => {
      let fullLogs = fs.readFileSync(this.rawLogFileLocation);
      let logs = fullLogs.toString().split("\n");
      // console.log('logs are', logs)
      var prettyLogs = [] as RawLogs[];
      for (var log of logs) {
        // console.log('log is', log)
        try {
          if (log && !(log === " ") && !(log === "")) {
            try {
              var logJSON = JSON.parse(log) as RawLogs;
              // console.log('logJSON is', logJSON)
              logJSON.uniqueId = sha256(logJSON.url)
              logJSON.address = sha256.hmac(masterSalt, logJSON.address)
              prettyLogs.push(logJSON)
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
      resolve(prettyLogs)
    })
  }

  /*
    @writeDailyLogs
      generates the daily log file (/logs/)
  */
  private async writeDailyLogs(logs: FormattedLogsArray): Promise<any> {
    return new Promise((resolve, reject) => {
      // generate the log payload
      var data = {
        gateway: this.node_id,
        lastUpdate: new Date(),
        summary: new Array(),
        signature: '',
        version: version
      }
      // sign it 
      data.signature = signLogs(data)
      for (var key in logs) {
        var log = logs[key]
        if (log && log.addresses) {
          data.summary.push(log)
        }
      }
      fs.writeFile(this.logFileLocation, JSON.stringify(data), {}, function (err) {
        if (err) {
          // console.log('ERROR SAVING ACCESS LOG', err)
          resolve({ success: false, logs: data, error: err })
        } else {
          resolve({ success: true, logs: data })
        }
      });
    })
  }

  /*
    generate the log files
  */
  private async createLogFile(name: string): Promise<any> {
    return new Promise(async (resolve, reject) => {
      // resolve('/tmp/' + name as string)
      if (this.fileDIR > '') {
        var fileName = this.fileDIR + name;
        try {
          await writeEmptyFile(fileName)
          resolve(fileName);
        } catch (err) {
          reject('error writing log file ' + fileName)
        }
      } else {
        tmp.file(function _tempFileCreated(err, path: string, fd) {
          if (err) reject(err);
          // console.log('fd', fd)
          // console.log('File: ', path);
          resolve(path);
        });
      }
    });
  }
}

export = koiLogs;

//////////////////////// Utility Functions //////////////////////////////
/*
  generates and returns a signature for a koi logs payload
*/
function signLogs(data: object) {
  // TODO - replace with koi.sign and ensure a seed phrase is saved by end user somehow
  return sha256(cryptoRandomString({ length: 10 })); // TODO
}

/*
  @sortAndFilterLogs
    logs - access.log output (raw data in array)
    resolves to an array of data payloads
*/
async function sortAndFilterLogs(logs: RawLogs[]) {
  return new Promise(async (resolve, reject) => {
    var formatted_logs = [] as FormattedLogsArray;

    try {
      for (var log of logs) {
        if (log.url && log.uniqueId) {
          if (!log.proof) log.proof = {} as any;
          if (!formatted_logs[log.uniqueId]) {
            formatted_logs[log.uniqueId] = {
              addresses: [log.address],
              url: log.url,
              proofs: [log.proof]
            }
          } else {
            if(!formatted_logs[log.uniqueId].addresses.includes(log.address)) {
              formatted_logs[log.uniqueId].addresses.push(log.address)
              formatted_logs[log.uniqueId].proofs.push(log.proof)
            } 
          }
        }
      }
      // console.log('about to resolve formattedlogs', formatted_logs.length, 'sample:', formatted_logs[formatted_logs.length - 1])
      resolve(formatted_logs)
    } catch (err) {
      reject(err)
    }
  })

}


async function writeEmptyFile(location: string) {
  return new Promise((resolve, reject) => {
    fs.writeFile(location, "", {}, function (err) {
      if (err) {
        // console.log('ERROR CREATING ACCESS LOG at' + location, err)
        resolve({ success: false, error: err })
      } else {
        resolve({ success: true })
      }
    });
  });
}

function getLogSalt() {

  return sha256(cryptoRandomString({ length: 10 }))

}
