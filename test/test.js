const Express = require('express');
const koiLogs = require('../dist/index.js');

const app = new Express ();

startServer()

// add koi tasks
async function startServer ( ) {
  var koiLogger = new koiLogs ("/home/al/");
  app.use(koiLogger.middleware);
  app.get("/logs/", koiLogger.koiLogsHelper);
  app.get("/logs/raw/", koiLogger.koiRawLogsHelper);

  // start the server listener
  app.listen(process.env.PORT || 3000, () => {
    console.log(`[app] started on http://localhost:${process.env.PORT || 3000}`);
  });
}