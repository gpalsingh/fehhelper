const moment = require("moment-timezone");
const util = require("./util.js");
const config = require("../config.json");
const scraper = require("./scraper");

moment.tz.setDefault(config.JP_TIME_ZONE);
const START_TIME = moment(config.VG_START_TIME).tz(config.JP_TIME_ZONE);

function createCurrentBattlesMessage(data) {
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

function createMessage() {
  return scraper.getCurrentBattlesData()
  .then(data => {
    return createCurrentBattlesMessage(data);
  })
  .catch(err => {
    console.log(err);
    return "I couldn't get the data for some reason. Blame nite!";
  });
}

function isBattleAvailable() {
  /* Returns [message, event open to battle] */
  let battles_on = false;
  if (!getEventStarted()) {
    return ["Event hasn't started yet!", battles_on];
  }
  if (getEventEnded()) {
    return ["The event ended. Let me go already...", battles_on];
  }

  const time_now = moment();
  /* Each round consists of 48 hours
     45 hours fights, 3 hours wait
     Last round is only 45 minutes
     The last value is sentinel to signal voting gauntlet ended */
  const increment_hours = [45, 3, 45, 3, 45, 0];
  let message = "Battles are currently available";

  let time_pointer = START_TIME.clone();
  for (hours of increment_hours) {
    battles_on = !battles_on;
    time_pointer.add(hours, "hours");
    if (time_pointer > time_now) {
      break;
    }
  }

  if (!battles_on) {
    message = "Still waiting for next round to start";
  }

  return [message, battles_on];
}

function getEventStarted() {
  const time_now = moment();
  return time_now > START_TIME;
}

function getEventEnded() {
  const time_now = moment();
  const end_time = START_TIME.clone().add(3, 'days').subtract(3, 'hours');
  return time_now > end_time;
}

function isEventRunning() {
  return (getEventStarted() && (!getEventEnded()));
}

module.exports = {
  getGauntletStatusMessage: function() {
    /* Returns Promise containing string */
    let [message, battles_on] = isBattleAvailable();
    if (battles_on) return createMessage();
    let messagePromise = new Promise((resolve, reject) => {
      resolve(message);
    });
    return messagePromise;
  },
  createMessage: createMessage,
  isBattleAvailable: isBattleAvailable,
  getEventEnded: getEventEnded,
}
