const rp = require('request-promise');
const moment = require('moment-timezone');
const util = require('./util.js');
const config = require('../config.json');
const scraper = require("./scraper");

function createMessage(data) {
  let message = '';

  for (let i in data) {
    const heroes = data[i];
    let winner = 0;
    if (heroes[1]['score'] > heroes[0]['score']) {
      winner = 1;
    }
    const loser = winner === 0 ? 1 : 0;
    let difference = heroes[winner]['score'] - heroes[loser]['score'];
    difference = util.numberWithCommas(difference);

    message += `\n${heroes[winner]['name']} beating ${heroes[loser]['name']} by ${difference}`;
  }

  return message;
}

function getGauntletStatus() {
  return rp(config.VG_URL)
  .then(html => {
    let data = scraper.extractGauntletData(html);
    return createMessage(data);
  })
  .catch(err => {
    console.log(err);
    return "I couldn't get the data for some reason. Blame nite!";
  });
}

function isVotingGauntletLive() {
  /* Returns [message, fights happening, event over] */
  moment.tz.setDefault(config.TIME_ZONE);
  const startTime = moment(config.VG_START_TIME).tz(config.TIME_ZONE);
  const time_now = moment();
  const total_rounds = 3;
  /* Each round consists of 48 hours
     45 hours fights, 3 hours wait
     Last round is only 45 minutes 
     The last value is sentinel to signal voting gauntlet ended */
  const increment_hours = [45, 3, 45, 3, 45, -1];
  let message = '';
  let [fights_on, event_ended] = [false, false];
  if (time_now < startTime) {
    return ["Event hasn't started yet!", fights_on, false];
  }

  let time_pointer = startTime;
  for (hours of increment_hours) {
    fights_on = !fights_on;
    if (hours === -1) {
      event_ended = true;
      break;
    }
    time_pointer.add(hours, 'hours');
    if (time_pointer > time_now) {
      break;
    }
  }

  if (!fights_on) {
    if (event_ended) {
      message = 'The event ended. Let me go already...';
    } else {
      message = 'Still waiting for next round to start';
    }
  }

  return [message, fights_on];
}

function showGauntletStatusBg(client) { 
  let [_, fights_on] = isVotingGauntletLive();
  if (fights_on) {
    util.sendAnnouncement(getGauntletStatus(client));
  }
  
}

function startVgTimer(client) {
  showGauntletStatusBg(client);
  const ms_in_hour = 60 * 60 * 1000;
  setInterval(showGauntletStatusBg, ms_in_hour, client);
}

function setupVotingGauntletTimer(client) {
  moment.tz.setDefault('Asia/Tokyo');
  const now = moment();
  // offset by 5 minutes in case website is late to update
  const offset = 5;
  const minutes_left_till_hour = 60 + offset - now.minutes();
  const milliseconds_left = minutes_left_till_hour * 60 * 1000;
  setTimeout(startVgTimer, milliseconds_left, client);
}

module.exports = {
  getGauntletStatus: function() {
    /* Returns Promise containing string */
    let [message, fights_on] = isVotingGauntletLive();
    if (fights_on) return getGauntletStatus();
    let messagePromise = new Promise((resolve, reject) => {
      resolve(message);
    });
    return messagePromise;
  },
  setupVotingGauntletTimer: client => setupVotingGauntletTimer(client)
}
