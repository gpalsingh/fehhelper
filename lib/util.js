const TESTING = false;
const LOCAL = false;
let announce_channel;

if (TESTING) {
  announce_channel = process.env.VG_BOT_TEST_CHANNEL;
} else {
  announce_channel = process.env.VG_BOT_CHANNEL;
}
const BOT_CHANNEL = announce_channel;

function sendMsgToClient(client, msg) {
  if (TESTING && LOCAL) {
    console.log(msg);
    return;
  }
  client.channels.get(BOT_CHANNEL).send(msg).catch(err => {
    console.log(err);
  });
}

function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function numberWithoutCommas(x) {
  return x.replace(/,/g, "");
}

module.exports = {
  sendAnnouncement: sendMsgToClient,
  numberWithCommas: numberWithCommas,
  numberWithoutCommas: numberWithoutCommas,
}