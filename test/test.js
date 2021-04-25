var express = require('express');
var koiLogs = require("../dist/index.js");

var koiLogger = new koiLogs();

var app = new express();

app.get("/logs/", async function (req, res) {
  return await koiLogger.koiLogsHelper(req, res)
});
app.get("/logs/raw/", async function(req, res) { 
  return await koiLogger.koiRawLogsHelper(req, res)
});
app.get("/logs/info", async function(req, res) { 
  return await koiLogger.info(req, res)
});

app.use(koiLogger.logger);

app.get("/info/", async function (req, res) {
  return res.status(200).send("<html><i>Welcome to the fish pond.</i><html>");
})

// start the server listener
app.listen(process.env.PORT || 3000, () => {
  console.log(`[app] started on http://localhost:${process.env.PORT || 3000}`);
});
