// XXX even though ethers is not used in the code below, it's very likely
// it will be used by any DApp, so we are already including it here
const { ethers } = require("ethers");
const math = require('mathjs')

const rollup_server = process.env.ROLLUP_HTTP_SERVER_URL;
console.log("HTTP rollup_server url is " + rollup_server);


function hex2str(hex) {
  return Buffer.from(hex.slice(2), 'hex').toString('utf-8');
}

function str2hex(str) {
  return '0x' + Buffer.from(str, 'utf-8').toString('hex');
}

async function handle_advance(data) {
  console.log(`Received advance request data ${JSON.stringify(data)}`);

  let status = 'accept';
  try {
    const input = hex2str(data.payload);
    console.log(`Received input: ${input}`);

    const output = math.evaluate(input);

    console.log(`Adding notice with payload: '${output}'`);
    const response = await fetch(`${rollup_server}/notice`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ payload: str2hex(String(output)) }),
    });

    console.log(`Received notice status ${response.status} body ${await response.text()}`);
  } catch (error) {
      status = 'reject';
      const msg = `Error processing data ${JSON.stringify(data)}\n${error.stack}`;
      console.error(msg);

      const response = await fetch(`${rollup_server}/report`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({ payload: str2hex(msg) }),
      });

      console.log(`Received report status ${response.status} body ${await response.text()}`);
  }

  return status;
}

async function handle_inspect(data) {
  console.log(`Received inspect request data ${JSON.stringify(data)}`);
  console.log('Adding report');

  const response = await fetch(`${rollup_server}/report`, {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
      },
      body: JSON.stringify({ payload: data.payload }),
  });

  console.log(`Received report status ${response.status}`);
  return 'accept';
}


var handlers = {
  advance_state: handle_advance,
  inspect_state: handle_inspect,
};

var finish = { status: "accept" };

(async () => {
  while (true) {
    const finish_req = await fetch(rollup_server + "/finish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "accept" }),
    });

    console.log("Received finish status " + finish_req.status);

    if (finish_req.status == 202) {
      console.log("No pending rollup request, trying again");
    } else {
      const rollup_req = await finish_req.json();
      var handler = handlers[rollup_req["request_type"]];
      finish["status"] = await handler(rollup_req["data"]);
    }
  }
})();
