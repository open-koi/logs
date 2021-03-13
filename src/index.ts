import * as fs from 'fs';
import { Request, Response } from 'express';
import path from 'path';
import { sha256 } from 'js-sha256';
import cryptoRandomString = require("crypto-random-string")
import cron from 'node-cron';
import { generateKoiMiddleware } from './middleware';
import tmp from 'tmp';
import { sign } from 'node:crypto';

// these will be populated when the library is instantiated
var logFileLocation: string;
var rawLogFileLocation: string;
var proofFileLocation: string;
var node_id: string; // this will be used to deduplicate logs between gateway nodes
var fileDIR: string; // the desired log file directory (if the tmp module is not an option, i.e. docker containers)

function setDefaults() {
  logFileLocation = "";
  rawLogFileLocation = "";
  proofFileLocation = "";
}

interface ExpressApp {
  use: Function,
  get: Function
}

interface RawLogs {
  address: string,
  user: string,
  date: string,
  method: string,
  uniqueId: string,
  url: string,
  ref: string,
}

interface FormattedLogs {
  addresses: string[],
  url: string
}

interface FormattedLogsArray extends Array<FormattedLogs> {
  [key: string]: any
}

function getLogSalt() {

  return sha256(cryptoRandomString({ length: 10 }))

}

export const joinKoi = async function (app: ExpressApp, path?: string) {
  if (path) {
    fileDIR = path;
  }
  setDefaults()
  await generateLogFiles()
  node_id = await getLogSalt()
  const koiMiddleware = await generateKoiMiddleware(rawLogFileLocation)
  app.use(koiMiddleware);
  app.get("/logs/", koiLogsHelper);
  app.get("/logs/raw/", koiRawLogsHelper);
  koiLogsDailyTask() // start the daily log task
}

export const koiLogsHelper = function (req: Request, res: Response) {
  // console.log('logs file path is ', logFileLocation)
  fs.readFile(logFileLocation, 'utf8', (err: any, data: any) => {
    if (err) {
      console.error(err)
      res.status(500).send(err);
      return
    }
    // console.log(data)
    res.status(200).send(data);
  })
}

export const koiRawLogsHelper = function (req: Request, res: Response) {
  // console.log('logs file path is ', logFileLocation)
  fs.readFile(rawLogFileLocation, 'utf8', (err: any, data: any) => {
    if (err) {
      console.error(err)
      res.status(500).send(err);
      return
    }
    // console.log(data)
    res.status(200).send(data);
  })
}

export const koiLogsDailyTask = function () {
  return cron.schedule('0 0 * * *', async function () {
    console.log('running the log cleanup task once per day on ', new Date());
    let result = await logsTask()
    console.log('daily log task returned ', result)
  });
}

export const logsTask = async function () {
  return new Promise(async (resolve, reject) => {
    try {
      let masterSalt = getLogSalt()

      // then get the raw logs
      let rawLogs = await readRawLogs(masterSalt) as RawLogs[];

      let sorted = await sortAndFilterLogs(rawLogs) as FormattedLogsArray;

      let result = await writeDailyLogs(sorted);

      // last, clear old logs
      await clearRawLogs();

      resolve(result)

    } catch (err) {
      console.error('error writing daily log file', err)
      reject(err)
    }
  })
}

/*
  @readRawLogs
    retrieves the raw logs and reads them into a json array
*/
async function readRawLogs(masterSalt: string) {
  return new Promise((resolve, reject) => {
    let fullLogs = fs.readFileSync(rawLogFileLocation);
    let logs = fullLogs.toString().split("\n");
    var prettyLogs = [] as RawLogs[];
    for (var log of logs) {
      try {
        if (log && !(log === " ") && !(log === "")) {
          try {
            var logJSON = JSON.parse(log) as RawLogs;
            logJSON.uniqueId = sha256(logJSON.url)
            logJSON.address = sha256.hmac(masterSalt, logJSON.address)
            prettyLogs.push(logJSON)
          } catch (err) {
            console.error('error reading json in Koi log middleware', err)
            reject(err)
          }
        } 
      } catch (err) {
        console.error('err', err)
        reject(err)
      }
    }
    resolve(prettyLogs)
  })
}

/*
  @writeDailyLogs
    generates the daily log file (/logs/)
*/
async function writeDailyLogs(logs: FormattedLogsArray) {
  return new Promise((resolve, reject) => {
    // generate the log payload
    var data = {
      gateway: node_id,
      lastUpdate: new Date(),
      summary: new Array(),
      signature: ''
    }
    // sign it 
    data.signature = signLogs(data)
    for (var key in logs) {
      var log = logs[key]
      if (log && log.addresses) {
        data.summary.push(log)
      }
    }
    fs.writeFile(logFileLocation, JSON.stringify(data), {}, function (err) {
      if (err) {
        console.log('ERROR SAVING ACCESS LOG', err)
        resolve({ success: false, logs: data, error: err })
      } else {
        resolve({ success: true, logs: data })
      }
    });
  })
}

async function generateLogFiles() {
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

          var path = await createLogFile(name) as string;

          paths.push(path)


        } catch (err) {
          reject(err)
        }
      }

      console.log('created paths', paths, paths[0])

      // set the log file names in global vars
      // sloppy, needs to move to cleaner OOP
      logFileLocation = paths[0]
      rawLogFileLocation = paths[1]
      proofFileLocation = paths[2]

      // return their file names to the caller
      resolve(paths)

    } catch (err) {
      reject(err)
    }
  })
}

/*
  generate the log files
*/
async function createLogFile(name: string) {
  return new Promise(async (resolve, reject) => {
    // resolve('/tmp/' + name as string)
    if (fileDIR > '') {
      resolve (fileDIR + name);
    } else {
      tmp.file(function _tempFileCreated(err, path:string, fd) {
        if (err) reject(err);
        console.log('fd', fd)
        console.log('File: ', path);
        resolve (path);
      });
    }
  });
}

/*
  generates and returns a signature for a koi logs payload
*/
function signLogs(data: object) {
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
          if (formatted_logs[log.uniqueId] && !formatted_logs[log.uniqueId].addresses.includes(log.address)) {
            formatted_logs[log.uniqueId].addresses.push(log.address)
          } else {
            formatted_logs[log.uniqueId] = {
              addresses: [log.address],
              url: log.url
            }
          }
        }
      }
      resolve(formatted_logs)
    } catch (err) {
      reject(err)
    }
  })

}

/*
  @clearRawLogs
    removes the old access logs file
*/
async function clearRawLogs() {
  return new Promise((resolve, reject) => {
    fs.truncate(rawLogFileLocation, 0, function () {
      resolve(true)
    });
  });
}
