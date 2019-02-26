const moment = require("moment-timezone");
const util = require("./util.js");
const config = require("../config.json");
const scraper = require("./scraper");

moment.tz.setDefault(config.JP_TIME_ZONE);
const START_TIME = moment(config.VG_START_TIME).tz(config.JP_TIME_ZONE);

function getMultiplierAndMinutesLeft(round_number) {
  if ((round_number < 1) || (round_number > 3)) return 0;
  const rounds_over = round_number - 1;
  const hours_passed = rounds_over * 48;
  const round_start_time = START_TIME.clone().add(hours_passed, 'hours');
  const time_now = moment();
  const time_elapsed_in_ms = time_now.valueOf() - round_start_time.valueOf();
  const hours_passed_since_round_start = time_elapsed_in_ms / (1000 * 60 * 60);
  const rounded_hours = parseInt(hours_passed_since_round_start);
  const multiplier = ((rounded_hours * 0.1) + 3.1).toPrecision(2);
  const minutes_left = parseInt(((rounded_hours + 1) - hours_passed_since_round_start) * 60);

  return [multiplier, minutes_left];
}

function createCurrentBattlesMessages(data, round_number, options) {
  let messages = [];

  for (let i in data) {
    const heroes = data[i];
    let winner = 0, loser = 1;

    if (heroes[1]['score'] > heroes[0]['score']) {
      [winner, loser] = [loser, winner];
    }

    const advantage = (heroes[winner]['score'] / heroes[loser]['score']).toPrecision(4);
    const multiplier_active = (advantage > 1.01);

    if (multiplier_active) {
      const [multiplier, minutes_left] = getMultiplierAndMinutesLeft(round_number);
      let loser_id = heroes[loser]['name'];
      if (options.mention_army && options.channel) {
        try {
          loser_army_role_name = util.getRoleNameFromHeroName(heroes[loser]['name']);
          const loser_army_role = options.channel.guild.roles.find(item => item.name === loser_army_role_name);
          if (loser_army_role) {
            loser_id = loser_army_role;
          } else {
            console.log('Failed to find role', loser_army_role_name);
          }
        } catch(err) {
          console.log('Error ignored:', err);
        }
      }
      messages.push(
        `x${multiplier} multiplier for ${loser_id} for next ${minutes_left} minutes against ${heroes[winner]['name']}`
        );
    } else if(!options.multiplier_only) {
      messages.push(`${heroes[loser]['name']} is losing to ${heroes[winner]['name']} but not by much`);
    }
  }

  if ((messages.length === 0) && (!options.background)) {
    messages.push("All heroes are tied right now");
  }

  if (options.single) {
    messages = messages.join('\n');
  }

  return messages;
}

function getCurrentBattlesMessages(round_number, options) {
  return scraper.getCurrentBattlesData()
  .then(data => {
    try {
      return createCurrentBattlesMessages(data, round_number, options);
    } catch(err) {
      console.log("Failed to create background messages");
      console.log(err);
      return [];
    }
  })
  .catch(err => {
    console.log(err);
    return ["I couldn't get the data for some reason. Blame nite!"];
  });
}

function getRoleFromHeroName(channel, hero_name_args) {
  /* Make sure we match exact role names
     Or this function can be abused to get other roles too */
  const hero_name = hero_name_args.map(x => util.ucfirst(x)).join(" ");
  const hero_role_name = util.getRoleNameFromHeroName(hero_name);
  return channel.guild.roles.find(role => role.name === hero_role_name);
}

module.exports = {
  getGauntletStatusMessage: function() {
    /* Returns Promise resolving to string */
    let [message, battles_on, round_number] = util.isBattleAvailable();
    if (battles_on) return getCurrentBattlesMessages(round_number, {single: true});
    let messagePromise = new Promise((resolve, reject) => {
      resolve(message);
    });
    return messagePromise;
  },
  getCurrentBattlesMessages: getCurrentBattlesMessages,
  getRoleFromHeroName: getRoleFromHeroName,
}
