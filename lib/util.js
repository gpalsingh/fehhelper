const moment = require("moment-timezone");
const config = require("../config.json");
const latinize = require("latinize");
const TESTING = false;

moment.tz.setDefault(config.JP_TIME_ZONE);
const START_TIME = moment(config.VG_START_TIME).tz(config.JP_TIME_ZONE);

function sendAnnouncement(client, msg) {
  if (TESTING) {
    console.log(msg);
    return;
  }
  const guild = client.guilds.get(process.env.VG_BOT_SERVER_ID);
  const announce_channel = guild.channels.find(channel => channel. name === config.ANNOUNCEMENT_CHANNEL);
  if (announce_channel) {
    announce_channel.send(msg).catch(err => {console.log(err)});
    return;
  }
  console.log(`Couldn't find ${config.ANNOUNCEMENT_CHANNEL} channel`);
}

function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function numberWithoutCommas(x) {
  return x.replace(/,/g, "");
}

function isBattleAvailable() {
  /* Returns [message, event open to battle, round number] */
  let battles_on = false;
  let round_number = 0;
  if (!getEventStarted()) {
    return ["Event hasn't started yet!", battles_on, round_number];
  }
  if (getEventEnded()) {
    return ["The event ended. Let me go already...", battles_on, round_number];
  }
  const time_now = moment();
  /* Each round consists of 48 hours
     45 hours fights, 3 hours wait
     Last round is only 45 minutes
     The last value is sentinel to signal voting gauntlet ended */
  const increment_hours = [45, 3, 45, 3, 45, 0];
  let message = "Battles are currently available";
  let time_pointer = START_TIME.clone();
  let i = 0;
  for (hours of increment_hours) {
    battles_on = !battles_on;
    i++;
    round_number = Math.ceil(i / 2);
    time_pointer.add(hours, "hours");
    if (time_pointer > time_now) {
      break;
    }
  }
  if (!battles_on) {
    message = "Still waiting for next round to start";
  }
  return [message, battles_on, round_number];
}

function getEventStarted() {
  const time_now = moment();
  return time_now > START_TIME;
}

function getEventEnded() {
  const time_now = moment();
  const end_time = START_TIME.clone().add(6, 'days').subtract(3, 'hours');
  return time_now > end_time;
}

function getMsTillNextHour() {
  const now = moment();
  const minutes_left_till_hour = 60 - now.minutes();
  const milliseconds_left = minutes_left_till_hour * 60 * 1000;

  return milliseconds_left;
}

function ucfirst(s) {
  const converted_str = latinize(s.toLowerCase());
  return converted_str.charAt(0).toUpperCase() + converted_str.slice(1);
}

function getRoleNameFromHeroName(hero_name) {
  return config.ARMY_ROLE.replace(/#/, hero_name);
}

module.exports = {
  sendAnnouncement: sendAnnouncement,
  numberWithCommas: numberWithCommas,
  numberWithoutCommas: numberWithoutCommas,
  isBattleAvailable: isBattleAvailable,
  getEventStarted: getEventStarted,
  getEventEnded: getEventEnded,
  getMsTillNextHour: getMsTillNextHour,
  ucfirst: ucfirst,
  getRoleNameFromHeroName: getRoleNameFromHeroName,
}