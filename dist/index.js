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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const fs = __importStar(require("fs"));
const js_sha256_1 = require("js-sha256");
const cryptoRandomString = require("crypto-random-string");
const node_cron_1 = __importDefault(require("node-cron"));
const tmp_1 = __importDefault(require("tmp"));
const moment_1 = __importDefault(require("moment"));
let crypto = require("crypto");
// const { koi_tools } = require("koi_tools");
const tools = require("@_koi/sdk/web");
const koi = new tools.Web();
// import MockDate from 'mockdate';
// var date = "2021-06-29";
// var time = "23:57";
// MockDate.set(moment(date + ' ' + time).toDate());
const cronstring = '0 0 0 * * *';
console.log("\n" + moment_1.default() + "\n");
// const cronstring = "0 */2 * * * *";
const version = "1.0.3";
class koiLogs {
    constructor(path) {
        this.logger = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            if (!this.rawLogFileLocation) {
                yield this.rawLogFileLocation;
            }
            var payload = {
                address: req.ip,
                date: new Date(),
                method: req.method,
                url: req.path,
                type: req.protocol,
                proof: {
                    signature: req.headers["x-request-signature"],
                    public_key: req.headers["request-public-key"],
                    network: req.headers["Network-Type"],
                },
            };
            console.log(this.rawLogFileLocation);
            if (payload.proof.signature) {
                let dataAndSignature = JSON.parse(payload.proof.signature);
                let valid = yield koi.verifySignature(Object.assign(Object.assign({}, dataAndSignature), { owner: payload.proof.public_key }));
                if (!valid) {
                    console.log("Signature verification failed");
                    return next();
                }
                let signatureHash = crypto
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
        });
        if (path) {
            this.fileDIR = path;
        }
        console.log(`\n${this.fileDIR}\n`);
        this.i = 0;
        this.logFileLocation = "";
        this.rawLogFileLocation = "";
        this.proofFileLocation = "";
        this.currentDate = "";
        this.previousDateFileLocation = "";
        this.currentLogFileDir = "";
        this.generateLogFiles().then(() => {
            this.koiLogsDailyTask();
        });
        this.node_id = getLogSalt();
    }
    generateLogFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    // create three files (access.log, daily.log, and proofs.log) with names corresponding to the date
                    // var date = new Date();
                    // var names = [
                    //   date.toISOString().slice(0, 10) + '-daily.log',
                    //   date.toISOString().slice(0, 10) + '-access.log',
                    //   date.toISOString().slice(0, 10) + '-proofs.log',
                    // ]
                    this.currentDate = moment_1.default();
                    const currentDateStr = this.currentDate.format("Y-MM-DD");
                    const dayBeforeCurrentDateStr = this.currentDate.subtract(1, "days").format("Y-MM-DD");
                    let names = [
                        dayBeforeCurrentDateStr + "-daily.log",
                        currentDateStr + "-access.log",
                        currentDateStr + "-proofs.log",
                        currentDateStr + "-daily.log"
                    ];
                    let paths = [];
                    for (var name of names) {
                        try {
                            var path = (yield this.createLogFile(name));
                            paths.push(path);
                        }
                        catch (err) {
                            reject(err);
                        }
                    }
                    // console.log('created paths', paths, paths[0])
                    // set the log file names in global vars
                    // sloppy, needs to move to cleaner OOP
                    this.logFileLocation = paths[0];
                    this.rawLogFileLocation = paths[1];
                    this.proofFileLocation = paths[2];
                    this.currentLogFileDir = paths[3];
                    // return their file names to the caller
                    resolve(paths);
                }
                catch (err) {
                    reject(err);
                }
            }));
        });
    }
    difficultyFunction(hash) {
        return hash.startsWith("00") || hash.startsWith("01");
    }
    koiLogsHelper(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var logLocation = this.logFileLocation;
            // console.log('entered koiLogsHelper at ', new Date(), !this, logLocation)
            if (logLocation === "")
                yield this.generateLogFiles();
            fs.readFile(logLocation, "utf8", (err, data) => {
                if (err) {
                    // console.error(err)
                    // console.log('sent err ', err, new Date());
                    return res.status(500).send(err);
                }
                // console.log('sent data ', data, new Date());
                return res.status(200).send(data);
            });
        });
    }
    info(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return res.status(200).send({
                node: this.node_id,
                version: version,
                timer: cronstring,
            });
        });
    }
    koiRawLogsHelper(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var logLocation = this.rawLogFileLocation;
            // console.log('entered koiRawLogsHelper at ', new Date(), !this, logLocation)
            if (logLocation === "")
                yield this.generateLogFiles();
            fs.readFile(logLocation, "utf8", (err, data) => {
                if (err) {
                    // console.error(err)
                    res.status(500).send(err);
                    return;
                }
                res.status(200).send(data);
            });
        });
    }
    koiLogsDailyTask() {
        return __awaiter(this, void 0, void 0, function* () {
            const _this = this;
            _this.logsTask(false);
            return node_cron_1.default.schedule(cronstring, function () {
                return __awaiter(this, void 0, void 0, function* () {
                    // console.log('running the log cleanup task once per day on ', new Date());
                    let result = yield _this.logsTask();
                    // console.log('daily log task returned ', result)
                });
            });
        });
    }
    logsTask(deleteRaw = true) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    let masterSalt = getLogSalt();
                    // then get the raw logs
                    let rawLogs = (yield this.readRawLogs(masterSalt));
                    console.log(`read rawLogs for -- ${this.rawLogFileLocation}`); //02
                    let sorted = (yield sortAndFilterLogs(rawLogs));
                    console.log(`sorted rawLogs for -- ${this.rawLogFileLocation}`); //02
                    let result = yield this.writeDailyLogs(sorted);
                    console.log(`wrote daily for -- ${this.logFileLocation}`);
                    // last, clear old logs
                    if (deleteRaw) {
                        yield this.clearRawLogs();
                        console.log("\nLOGS Cleared\n");
                        let result = yield this.writeDailyLogs(sorted);
                        console.log(`wrote daily for -- ${this.currentLogFileDir}`);
                        this.generateLogFiles();
                    }
                    resolve(result);
                }
                catch (err) {
                    // console.error('error writing daily log file', err)
                    reject(err);
                }
            }));
        });
    }
    /*
      @clearRawLogs
        removes the old access logs file
    */
    clearRawLogs() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                fs.truncate(this.rawLogFileLocation, 0, function () {
                    resolve(true);
                });
            });
        });
    }
    /*
      @readRawLogs
        retrieves the raw logs and reads them into a json array
    */
    readRawLogs(masterSalt) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                let fullLogs = fs.readFileSync(this.rawLogFileLocation);
                let logs = fullLogs.toString().split("\n");
                // console.log('logs are', logs)
                var prettyLogs = [];
                for (var log of logs) {
                    // console.log('log is', log)
                    try {
                        if (log && !(log === " ") && !(log === "")) {
                            try {
                                var logJSON = JSON.parse(log);
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
        });
    }
    /*
      @writeDailyLogs
        generates the daily log file (/logs/)
    */
    writeDailyLogs(logs) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                // generate the log payload
                var data = {
                    gateway: this.node_id,
                    lastUpdate: new Date(),
                    summary: new Array(),
                    signature: "",
                    version: version,
                };
                // sign it
                data.signature = signLogs(data);
                for (var key in logs) {
                    var log = logs[key];
                    if (log && log.addresses) {
                        data.summary.push(log);
                    }
                }
                fs.writeFile(this.currentLogFileDir, JSON.stringify(data), {}, function (err) {
                    if (err) {
                        // console.log('ERROR SAVING ACCESS LOG', err)
                        resolve({ success: false, logs: data, error: err });
                    }
                    else {
                        resolve({ success: true, logs: data });
                    }
                });
            });
        });
    }
    /*
      generate the log files
    */
    createLogFile(name) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                // resolve('/tmp/' + name as string)
                if (this.fileDIR > "") {
                    var fileName = this.fileDIR + name;
                    try {
                        if (!fs.existsSync(fileName)) {
                            yield writeEmptyFile(fileName);
                        }
                        resolve(fileName);
                    }
                    catch (err) {
                        reject("error writing log file " + fileName);
                    }
                }
                else {
                    tmp_1.default.file(function _tempFileCreated(err, path, fd) {
                        if (err)
                            reject(err);
                        // console.log('fd', fd)
                        // console.log('File: ', path);
                        resolve(path);
                    });
                }
            }));
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
function sortAndFilterLogs(logs) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            var formatted_logs = [];
            try {
                for (var log of logs) {
                    if (log.url && log.uniqueId) {
                        if (!log.proof)
                            log.proof = {};
                        if (!formatted_logs[log.uniqueId]) {
                            formatted_logs[log.uniqueId] = {
                                addresses: [log.address],
                                url: log.url,
                                proofs: [log.proof],
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
                resolve(formatted_logs);
            }
            catch (err) {
                reject(err);
            }
        }));
    });
}
function writeEmptyFile(location) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            fs.writeFile(location, "", {}, function (err) {
                if (err) {
                    // console.log('ERROR CREATING ACCESS LOG at' + location, err)
                    resolve({ success: false, error: err });
                }
                else {
                    resolve({ success: true });
                }
            });
        });
    });
}
function getLogSalt() {
    return js_sha256_1.sha256(cryptoRandomString({ length: 10 }));
}
module.exports = koiLogs;
//# sourceMappingURL=index.js.map