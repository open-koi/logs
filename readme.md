NOTE: This project is a work in progress. Currently testing is in progress on the Arweave Gateway Network, but this repo represents the current state of the work there for reference. 

# Koi Logs SDK
Koi is a network designed to reward and help to coordinate the creation of public data resources. Install the SDK to register your gateway to the network and begin receiving traffic awards when you contribute logging data.

## Implementation
Koi is installed as a feature of any gateway or software library to track traffic reliably and provide access to it when audited by another node. 

### Installation
Koi gateway logging can be implemented for express servers by adding the necessary routes and middleware shown below:

```
 

var app = new express();

app.get("/logs/", async function (req, res) {
  return await koiLogger.koiLogsHelper(req, res)
});
app.get("/logs/raw/", async function(req, res) { 
  return await koiLogger.koiRawLogsHelper(req, res)
});

app.use(koiLogger.logger);

app.get("/info/", async function (req, res) {
  return res.status(200).send("<html><i>Welcome to the fish pond.</i><html>");
})

```

Now, any traffic on your gateway will automatically be obfuscated and provided to the koi network, and you'll earn some koi. 

### Permissions
Please note: your /tmp/ directory must be writeable to your runtime user to ensure that the logs can be written properly. 

### Submitting Proofs
If you are building a tool that will interact with Koi gateways, you can submit two headers to opt into verifiable attention monitoring. This process is designed to be pseudonymous, but ensures the long term viability of attention tracking by substantiating raw traffic volume with bellweather data which can identify when there is a sufficiently large abnormality to represent possibly falsified traffic. 

Proofs can be submitted by attaching two additional HTTP headers to all requests to gateways:
KOI => 
`< base 64 sha 256 hash of id metadata + timestamp + requested resource, with difficulty below network limit >`
KOI_ID => 
`< Any valid arweave address >`

The proof data is stored in the standard log files, and provides an added layer of security and verification. Participating members of the community, in turn, receive Koi tokens proportionate to their value as a bellweather. 

## Log Files & Clearing Cycle
Each day, log files are updated over a 24 hour period, and subsequently released for public consumption via a /logs endpoint. 

## Example 
Check run `yarn test` to start.
