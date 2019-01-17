const moment = require("moment-timezone");
const util = require("./util.js");
const config = require("../config.json");
const vg = require("./vg-helper");

let BG_INTERVAL;

function showGauntletStatusBg(client) {
  if (util.getEventEnded()) {
    clearInterval(BG_INTERVAL);
    return;
  }
  let [_, battles_on, round_number] = util.isBattleAvailable();
  if (battles_on) {
    const options = {
      multiplier_only: true,
      background: true,
      mention_army: true,
      channel: client.channels.get(process.env.VG_BOT_CHANNEL)
    }
    vg.getCurrentBattlesMessages(round_number, options).then(msgs => {
      for (msg of msgs) {
        util.sendAnnouncement(client, msg);
      }
    });
  }
}

function startVgTimer(client) {
  showGauntletStatusBg(client);
  const ms_in_hour = 60 * 60 * 1000;
  BG_INTERVAL = setInterval(showGauntletStatusBg, ms_in_hour, client);
}

function setupVotingGauntletTimer(client) {
  moment.tz.setDefault(config.JP_TIME_ZONE);
  const now = moment();
  // offset by 5 minutes in case website is late to update
  const offset = 5;
  const minutes_left_till_hour = 60 + offset - now.minutes();
  const milliseconds_left = minutes_left_till_hour * 60 * 1000;
  setTimeout(startVgTimer, milliseconds_left, client);
}

module.exports = {
  setupVotingGauntletTimer: setupVotingGauntletTimer,
}