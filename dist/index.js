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
const middleware_1 = require("./middleware");
class koiLogs {
    constructor(path) {
        if (path) {
            this.fileDIR = path;
        }
        this.logFileLocation = "";
        this.rawLogFileLocation = "";
        var _this = this;
        // this.middleware = function () {
        //   return this.generateKoiMiddleware(_this.rawLogFileLocation);
        // }
        this.proofFileLocation = "";
        this.generateLogFiles();
        this.node_id = getLogSalt();
    }
    generateLogFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    // create three files (access.log, daily.log, and proofs.log) with names corresponding to the date
                    var date = new Date();
                    var names = [
                        date.toISOString().slice(0, 10) + '-daily.log',
                        date.toISOString().slice(0, 10) + '-access.log',
                        date.toISOString().slice(0, 10) + '-proofs.log',
                    ];
                    let paths = [];
                    for (var name of names) {
                        try {
                            var path = yield this.createLogFile(name);
                            paths.push(path);
                        }
                        catch (err) {
                            reject(err);
                        }
                    }
                    console.log('created paths', paths, paths[0]);
                    // set the log file names in global vars
                    // sloppy, needs to move to cleaner OOP
                    this.logFileLocation = paths[0];
                    this.rawLogFileLocation = paths[1];
                    this.proofFileLocation = paths[2];
                    // return their file names to the caller
                    resolve(paths);
                }
                catch (err) {
                    reject(err);
                }
            }));
        });
    }
    generateMiddleware() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('logslocation', this.rawLogFileLocation);
            if (!this || !this.rawLogFileLocation || this.rawLogFileLocation === "")
                yield this.generateLogFiles();
            return middleware_1.generateKoiMiddleware(this.rawLogFileLocation);
        });
    }
    koiLogsHelper(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var logLocation = this.logFileLocation;
            console.log('entered koiLogsHelper at ', new Date(), !this, logLocation);
            if (logLocation === "")
                yield this.generateLogFiles();
            fs.readFile(logLocation, 'utf8', (err, data) => {
                if (err) {
                    console.error(err);
                    console.log('sent err ', err, new Date());
                    return res.status(500).send(err);
                }
                console.log('sent data ', data, new Date());
                return res.status(200).send(data);
            });
        });
    }
    koiRawLogsHelper(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var logLocation = this.rawLogFileLocation;
            console.log('entered koiRawLogsHelper at ', new Date(), !this, logLocation);
            if (logLocation === "")
                yield this.generateLogFiles();
            fs.readFile(logLocation, 'utf8', (err, data) => {
                if (err) {
                    console.error(err);
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
            _this.logsTask();
            return node_cron_1.default.schedule('0 0 0 * * *', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    console.log('running the log cleanup task once per day on ', new Date());
                    let result = yield _this.logsTask();
                    console.log('daily log task returned ', result);
                });
            });
        });
    }
    logsTask() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    let masterSalt = getLogSalt();
                    // then get the raw logs
                    let rawLogs = yield this.readRawLogs(masterSalt);
                    let sorted = yield sortAndFilterLogs(rawLogs);
                    let result = yield this.writeDailyLogs(sorted);
                    // last, clear old logs
                    yield this.clearRawLogs();
                    resolve(result);
                }
                catch (err) {
                    console.error('error writing daily log file', err);
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
                var prettyLogs = [];
                for (var log of logs) {
                    try {
                        if (log && !(log === " ") && !(log === "")) {
                            try {
                                var logJSON = JSON.parse(log);
                                logJSON.uniqueId = js_sha256_1.sha256(logJSON.url);
                                logJSON.address = js_sha256_1.sha256.hmac(masterSalt, logJSON.address);
                                prettyLogs.push(logJSON);
                            }
                            catch (err) {
                                console.error('error reading json in Koi log middleware', err);
                                reject(err);
                            }
                        }
                    }
                    catch (err) {
                        console.error('err', err);
                        reject(err);
                    }
                }
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
                    signature: ''
                };
                // sign it 
                data.signature = signLogs(data);
                for (var key in logs) {
                    var log = logs[key];
                    if (log && log.addresses) {
                        data.summary.push(log);
                    }
                }
                fs.writeFile(this.logFileLocation, JSON.stringify(data), {}, function (err) {
                    if (err) {
                        console.log('ERROR SAVING ACCESS LOG', err);
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
                if (this.fileDIR > '') {
                    var fileName = this.fileDIR + name;
                    try {
                        yield writeEmptyFile(fileName);
                        resolve(fileName);
                    }
                    catch (err) {
                        reject('error writing log file ' + fileName);
                    }
                }
                else {
                    tmp_1.default.file(function _tempFileCreated(err, path, fd) {
                        if (err)
                            reject(err);
                        console.log('fd', fd);
                        console.log('File: ', path);
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
                        if (formatted_logs[log.uniqueId] && !formatted_logs[log.uniqueId].addresses.includes(log.address)) {
                            formatted_logs[log.uniqueId].addresses.push(log.address);
                        }
                        else {
                            formatted_logs[log.uniqueId] = {
                                addresses: [log.address],
                                url: log.url
                            };
                        }
                    }
                }
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
                    console.log('ERROR CREATING ACCESS LOG at' + location, err);
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