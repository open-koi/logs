const Express = require('express');
const koiLogs = require('../dist/index.js').default;

console.log('koilogs is', koiLogs)

const app = new Express ();

var koiLogger = new koiLogs ("/home/al/");
connectKoi()
async function connectKoi ( ) {

  var koiLoggerMiddleware = await koiLogger.generateMiddleware()
  console.log('created koi middleware', koiLoggerMiddleware)
  app.use(koiLoggerMiddleware);
  app.get("/logs/", async function(req, res) {
    return await koiLogger.koiLogsHelper(req, res)
  });
  app.get("/logs/raw/", async function(req, res) { 
    return await koiLogger.koiRawLogsHelper(req, res)
  });
  koiLogger.koiLogsDailyTask()
  
}

// start the server listener
app.listen(process.env.PORT || 3000, () => {
  console.log(`[app] started on http://localhost:${process.env.PORT || 3000}`);
});
