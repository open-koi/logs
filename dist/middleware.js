"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateKoiMiddleware = void 0;
const morgan_1 = __importDefault(require("morgan"));
const fs_1 = __importDefault(require("fs"));
function generateKoiMiddleware(logFileLocation) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            console.log('logFileLocation: ', logFileLocation);
            try {
                const accessLogStream = fs_1.default.createWriteStream(logFileLocation, { flags: 'a' });
                // parse for headers here to get "koi", and "koi-meta" and store in a separate stream to write to the fule at proofFileLocation (maybe needs a separate log middleware )
                resolve(morgan_1.default('{"address":":remote-addr","user":":remote-user","date":":date","method":":method","url":":url","type":"HTTP/:http-version","status":":status","res":{"length":":res[content-length]","time" : ":response-time ms"}, "ref":":referrer","agent":":user-agent"}', { stream: accessLogStream }));
                console.log('passed morgan point');
            }
            catch (err) {
                console.log('error in middleware', err);
                // reject(err)
            }
        }));
    });
}
exports.generateKoiMiddleware = generateKoiMiddleware;
//# sourceMappingURL=middleware.js.map