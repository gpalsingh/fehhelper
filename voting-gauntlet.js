const rp = require('request-promise');
const cheerio = require('cheerio');
const moment = require('moment-timezone');

const TESTING = false;
const LOCAL = false;
const VG_NO = 19;
const VG_URL = `https://support.fire-emblem-heroes.com/voting_gauntlet/tournaments/${VG_NO}?locale=en-US`;
const FAIL_MESSAGE = 'I couldn\'t get the data for some reason. Blame nite!'
const NAME_SELECTOR = 'body > div > section > article:nth-child(3) > ul > li > div > div > div > p:nth-child(1)';
const POINTS_SELECTOR = 'body > div > section > article:nth-child(3) > ul > li > div > div > div > p:nth-child(2)';
let bot_channel;

function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

if (TESTING) {
  bot_channel = process.env.VG_BOT_TEST_CHANNEL;
} else {
  bot_channel = process.env.VG_BOT_CHANNEL;
}
const BOT_CHANNEL = bot_channel;

function sendMessage(client, msg) {
  if (TESTING && LOCAL) {
    console.log(msg);
    return;
  }
  client.channels.get(BOT_CHANNEL).send(msg);
}

function extractGauntletData(html) {
  const $ = cheerio.load(html);
  const all_names = $(NAME_SELECTOR);
  const all_scores = $(POINTS_SELECTOR);
  const num_fights = all_names.length / 2;
  let fights_data = [];

  for(let fight_no = 0; fight_no < num_fights; fight_no++) {
    let fight_data = [];
    const base_offset = fight_no * 2;

    for (let side = 0; side < 2; side++) {
      let hero_data = {}
      const offset = base_offset + side;
      const name = all_names[offset]['children'][0]['data'];
      const score = all_scores[offset]['children'][0]['data'];
      hero_data['name'] = name;
      hero_data['score'] = BigInt(score.replace(/,/g, ''));
      fight_data.push(hero_data);
    }
    fights_data.push(fight_data);
  }


  return fights_data;
}

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
    difference = numberWithCommas(difference);

    message += `\n${heroes[winner]['name']} beating ${heroes[loser]['name']} by ${difference}`;
  }

  return message;
}

function showGauntletStatus(client) {
  rp(VG_URL)
  .then(html => {
    let data = extractGauntletData(html);
    const message = createMessage(data);
    sendMessage(client, message);
  })
  .catch(err => {
    console.log(err);
    sendMessage(client, FAIL_MESSAGE);
  });
}

function isVotingGauntletLive(client, background_task=false) {
  moment.tz.setDefault('Asia/Tokyo');
  const startTime = moment("2019-01-03 16:00").tz('Asia/Tokyo');
  const time_now = moment();
  const total_rounds = 3;
  const increment_hours = [45, 3];
  let event_on = false;
  if (time_now < startTime) {
    if (!background_task) sendMessage(client, "Event hasn't started yet!");
    return event_on;
  }

  let time_pointer = startTime;
  let late = true;
  for (let round = 1; round <= total_rounds; round++) {
    for (hours of increment_hours) {
      event_on = !event_on;
      time_pointer.add(hours, 'hours');
      if (time_pointer > time_now) {
        late = false;
        break;
      }
    }
    if (time_pointer > time_now) break;
  }

  if (late) event_on = !event_on;
  if (!(event_on || background_task)) {
    if (late) {
      sendMessage(client, 'The event ended. Let me go already...');
    } else {
      sendMessage(client, 'Still waiting for next round to start');
    }
  }

  return event_on;
}

function votingGauntletStatusBg(client) { 
  if (isVotingGauntletLive(client, background_task=true)) {
    showGauntletStatus(client);
  }
}

function startVgTimer(client) {
  votingGauntletStatusBg(client);
  const ms_in_hour = 60 * 60 * 1000;
  setInterval(votingGauntletStatusBg, ms_in_hour, client);
}

function setupVotingGauntletTimer(client) {
  moment.tz.setDefault('Asia/Tokyo');
  const now = moment();
  // offset by 5 minutes over the hour
  const offset = 5;
  const minutes_left_till_hour = 60 + offset - now.minutes();
  const milliseconds_left = minutes_left_till_hour * 60 * 1000;
  setTimeout(startVgTimer, milliseconds_left, client);
}

module.exports = {
  votingGauntletStatus: function(client) { 
    if (isVotingGauntletLive(client)) {
      showGauntletStatus(client);
    }
  },
  setupVotingGauntletTimer: client => setupVotingGauntletTimer(client)
}
