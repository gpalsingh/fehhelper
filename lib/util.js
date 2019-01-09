const TESTING = false;
const LOCAL = false;
let announce_channel;

if (TESTING) {
  announce_channel = process.env.VG_BOT_TEST_CHANNEL;
} else {
  announce_channel = process.env.VG_BOT_CHANNEL;
}
const BOT_CHANNEL = announce_channel;

function sendAnnouncement(client, msg) {
  if (TESTING && LOCAL) {
    console.log(msg);
    return;
  }
  client.channels.get(BOT_CHANNEL).send(msg);
}

module.exports = {
  sendMsgToClient: sendAnnouncement
}