const Express = require('express');
const { joinKoi, koiLogsHelper, koiRawLogsHelper, generateKoiMiddleware } = require('../dist/index.js');

var app = new Express ();

startServer()

// add koi tasks
async function startServer ( ) {
  app = await joinKoi(app, "/home/al/");

  // start the server listener
  app.listen(process.env.PORT || 3000, () => {
    console.log(`[app] started on http://localhost:${process.env.PORT || 3000}`);
  });
}