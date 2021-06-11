"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const fs = __importStar(require("fs"));
const promises_1 = require("fs/promises");
const js_sha256_1 = require("js-sha256");
const cryptoRandomString = require("crypto-random-string");
const node_cron_1 = __importDefault(require("node-cron"));
const tmp_1 = __importDefault(require("tmp"));
const crypto = require("crypto");
// import koi from 'koi_tools';
// TODO - fix wallet generation and signing using a seed phrase tmp wallet
const web_1 = require("@_koi/sdk/web");
// import * as e from "express";
// import { raw } from "express";
const koi = new web_1.Web();
const cronstring = "0 0 0 * * *";
const version = "1.0.3";
let _this;
class koiLogs {
    constructor(path) {
        this.logger = async (req, res, next) => {
            if (!this.rawLogFileLocation) {
                await this.rawLogFileLocation;
            }
            const payload = {
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
            fs.appendFile(this.rawLogFileLocation, JSON.stringify(payload) + "\r\n", function (err) {
                if (err)
                    throw err;
            });
            return next();
        };
        if (path) {
            this.fileDIR = path;
        }
        this.logFileLocation = "";
        this.rawLogFileLocation = "";
        this.proofFileLocation = "";
        this.generateLogFiles();
        this.node_id = getLogSalt();
    }
    async generateLogFiles() {
        // create three files (access.log, daily.log, and proofs.log) with names corresponding to the date
        const date = new Date();
        const names = [
            date.toISOString().slice(0, 10) + "-daily.log",
            date.toISOString().slice(0, 10) + "-access.log",
            date.toISOString().slice(0, 10) + "-proofs.log"
        ];
        const paths = [];
        for (const name of names) {
            const path = (await this.createLogFile(name));
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
    difficultyFunction(hash) {
        return hash.startsWith("00") || hash.startsWith("01");
    }
    async koiLogsHelper(req, res) {
        const logLocation = this.logFileLocation;
        // console.log('entered koiLogsHelper at ', new Date(), !this, logLocation)
        if (logLocation === "")
            await this.generateLogFiles();
        fs.readFile(logLocation, "utf8", (err, data) => {
            if (err) {
                // console.error(err)
                // console.log('sent err ', err, new Date());
                return res.status(500).send(err);
            }
            // console.log('sent data ', data, new Date());
            return res.status(200).send(data);
        });
    }
    async info(req, res) {
        return res.status(200).send({
            node: this.node_id,
            version: version,
            timer: cronstring
        });
    }
    async koiRawLogsHelper(req, res) {
        const logLocation = this.rawLogFileLocation;
        // console.log('entered koiRawLogsHelper at ', new Date(), !this, logLocation)
        if (logLocation === "")
            await this.generateLogFiles();
        fs.readFile(logLocation, "utf8", (err, data) => {
            if (err) {
                // console.error(err)
                res.status(500).send(err);
                return;
            }
            res.status(200).send(data);
        });
    }
    // Todo, replace this with setInterval
    async koiLogsDailyTask() {
        _this = this;
        _this.logsTask();
        return node_cron_1.default.schedule(cronstring, async function () {
            // console.log('running the log cleanup task once per day on ', new Date());
            const result = await _this.logsTask();
            // console.log('daily log task returned ', result)
        });
    }
    async logsTask() {
        const masterSalt = getLogSalt();
        // then get the raw logs
        const rawLogs = (await this.readRawLogs(masterSalt));
        const sorted = (await sortAndFilterLogs(rawLogs));
        const result = await this.writeDailyLogs(sorted);
        // last, clear old logs
        await this.clearRawLogs();
        return result;
    }
    /*
      @clearRawLogs
        removes the old access logs file
    */
    async clearRawLogs() {
        const fileHandle = await promises_1.open(this.rawLogFileLocation, "r+");
        await fileHandle.truncate(0);
    }
    /*
      @readRawLogs
        retrieves the raw logs and reads them into a json array
    */
    async readRawLogs(masterSalt) {
        return new Promise((resolve, reject) => {
            const fullLogs = fs.readFileSync(this.rawLogFileLocation);
            const logs = fullLogs.toString().split("\n");
            // console.log('logs are', logs)
            const prettyLogs = [];
            for (const log of logs) {
                // console.log('log is', log)
                try {
                    if (log && !(log === " ") && !(log === "")) {
                        try {
                            const logJSON = JSON.parse(log);
                            // console.log('logJSON is', logJSON)
                            logJSON.uniqueId = js_sha256_1.sha256(logJSON.url);
                            logJSON.address = js_sha256_1.sha256.hmac(masterSalt, logJSON.address);
                            prettyLogs.push(logJSON);
                        }
                        catch (err) {
                            // console.error('error reading json in Koi log middleware', err)
                            // reject(err)
                        }
                    }
                }
                catch (err) {
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
    async writeDailyLogs(logs) {
        // generate the log payload
        const data = {
            gateway: this.node_id,
            lastUpdate: new Date(),
            summary: [],
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
            await promises_1.writeFile(this.logFileLocation, JSON.stringify(data));
            return { success: true, logs: data };
        }
        catch (err) {
            return { success: false, logs: data, error: err };
        }
    }
    /*
      generate the log files
    */
    async createLogFile(name) {
        // resolve('/tmp/' + name as string)
        if (this.fileDIR > "") {
            const fileName = this.fileDIR + name;
            try {
                await writeEmptyFile(fileName);
                return fileName;
            }
            catch (err) {
                throw Error("error writing log file " + fileName);
            }
        }
        new Promise((resolve, reject) => {
            tmp_1.default.file(function _tempFileCreated(err, path, _fd) {
                if (err)
                    reject(err);
                resolve(path);
            });
        });
    }
}
//////////////////////// Utility Functions //////////////////////////////
/*
  generates and returns a signature for a koi logs payload
*/
function signLogs(data) {
    // TODO - replace with koi.sign and ensure a seed phrase is saved by end user somehow
    return js_sha256_1.sha256(cryptoRandomString({ length: 10 })); // TODO
}
/*
  @sortAndFilterLogs
    logs - access.log output (raw data in array)
    resolves to an array of data payloads
*/
async function sortAndFilterLogs(logs) {
    const formatted_logs = [];
    for (const log of logs) {
        if (log.url && log.uniqueId) {
            if (!log.proof)
                log.proof = {};
            if (!formatted_logs[log.uniqueId]) {
                formatted_logs[log.uniqueId] = {
                    addresses: [log.address],
                    url: log.url,
                    proofs: [log.proof]
                };
            }
            else {
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
async function writeEmptyFile(location) {
    try {
        const result = await promises_1.writeFile(location, "");
        return { success: true };
    }
    catch (err) {
        return { success: false, error: err };
    }
}
function getLogSalt() {
    return js_sha256_1.sha256(cryptoRandomString({ length: 10 }));
}
module.exports = koiLogs;
//# sourceMappingURL=index.js.map