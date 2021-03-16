import morgan from 'morgan';
import id from 'shortid';
import {Request, Response, NextFunction} from 'express';
import fs from 'fs';
import path from 'path';

export async function generateKoiMiddleware (logFileLocation: string) {
  return new Promise(async (resolve, reject) => {
    console.log('logFileLocation: ', logFileLocation)
    try {

      const accessLogStream = fs.createWriteStream(logFileLocation, {flags: 'a'});
    
      // parse for headers here to get "koi", and "koi-meta" and store in a separate stream to write to the fule at proofFileLocation (maybe needs a separate log middleware )

      resolve(morgan('{"address":":remote-addr","user":":remote-user","date":":date","method":":method","url":":url","type":"HTTP/:http-version","status":":status","res":{"length":":res[content-length]","time" : ":response-time ms"}, "ref":":referrer","agent":":user-agent"}',
        { stream: accessLogStream }
      ));
      console.log('passed morgan point')
    } catch (err) {
      console.log('error in middleware', err)
      // reject(err)
    }
    
  })
}