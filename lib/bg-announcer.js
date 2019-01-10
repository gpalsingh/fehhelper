const moment = require("moment-timezone");
const util = require("./util.js");
const config = require("../config.json");
const { isBattleAvailable, getVgStatusForced } = require("./vg-helper");

function showGauntletStatusBg(client) {
  let [_, battles_on] = isBattleAvailable();
  if (battles_on) {
    getVgStatusForced().then(msg => {
      util.sendAnnouncement(client, msg);
    });
  }
}

function startVgTimer(client) {
  showGauntletStatusBg(client);
  const ms_in_hour = 60 * 60 * 1000;
  setInterval(showGauntletStatusBg, ms_in_hour, client);
}

function setupVotingGauntletTimer(client) {
  moment.tz.setDefault(config.TIME_ZONE);
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