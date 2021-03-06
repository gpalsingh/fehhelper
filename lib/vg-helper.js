const moment = require("moment-timezone");
const util = require("./util.js");
const config = require("../config.json");
const scraper = require("./scraper");

moment.tz.setDefault(config.JP_TIME_ZONE);
const START_TIME = moment(config.VG_START_TIME).tz(config.JP_TIME_ZONE);

function getMultipliersAndMinutesLeft(round_number) {
  if ((round_number < 1) || (round_number > 3)) return 0;
  const rounds_over = round_number - 1;
  const hours_passed = rounds_over * 48;
  const round_start_time = START_TIME.clone().add(hours_passed, 'hours');
  const time_now = moment();
  const time_elapsed_in_ms = time_now.valueOf() - round_start_time.valueOf();
  const hours_passed_since_round_start = time_elapsed_in_ms / (1000 * 60 * 60);
  const rounded_hours = parseInt(hours_passed_since_round_start);
  const multiplier = ((rounded_hours * 0.2) + 3.2).toFixed(2);
  const ed_multiplier = ((rounded_hours * 0.05) + 1.05).toFixed(2);
  const minutes_left = parseInt(((rounded_hours + 1) - hours_passed_since_round_start) * 60);

  return [multiplier, ed_multiplier, minutes_left];
}

function createCurrentBattlesMessages(fights_data, round_number, options) {
  let messages = [];
  const [multiplier, ed_multiplier, minutes_left] = getMultipliersAndMinutesLeft(round_number);
  /* Endurance multiplier for the army with advantage */
  const GUILD_CHANNEL = options.channel;

  for (let fight of fights_data) {
    if (fight.hasMultiplier === true) {
      let loser_id = fight.losingHero.displayName;
      let winner_id = fight.winningHero.displayName;
      /* Find roles if possible. Fallback to role names */
      if (options.mention_army && GUILD_CHANNEL) {
        try {
          /* Find loser role */
          if (!options.winner_only) {
            const loser_army_role_name = util.getRoleNameFromHeroName(fight.losingHero.displayName);
            const loser_army_role = GUILD_CHANNEL.guild.roles.cache.find(item => item.name === loser_army_role_name);
            if (loser_army_role) {
              loser_id = loser_army_role;
            } else {
              console.log('Failed to find loser role', loser_army_role_name);
            }
          }
          /* Find winner role */
          if (!options.loser_only) {
            const winner_army_role_name = util.getRoleNameFromHeroName(fight.winningHero.displayName);
            const winner_army_role = GUILD_CHANNEL.guild.roles.cache.find(item => item.name === winner_army_role_name);
            if (winner_army_role) {
              winner_id = winner_army_role;
            } else {
              console.log('Failed to find winner role', winner_army_role_name);
            }
          }
        } catch(err) {
          console.log('Error ignored:', err);
        }
      }
      if (options.loser_only) {
        messages.push(
          `x${multiplier} multiplier for ${loser_id} for next ${minutes_left} minutes against ${fight.winningHero.displayName}`
          );
      } else if (options.winner_only) {
        messages.push(
          `x${ed_multiplier} multiplier for ${winner_id} for next ${minutes_left} minutes against ${fight.losingHero.displayName}`
          );
      } else {
        let msg = `x${multiplier} multiplier for ${fight.losingHero.displayName}`;
        msg += ` against ${fight.winningHero.displayName} with x${ed_multiplier} multiplier for next ${minutes_left} minutes`;
        messages.push(msg);
      }
    } else if (!options.multiplier_only) {
      messages.push(`${fight.losingHero.displayName} is losing to ${fight.winningHero.displayName} but not by much`);
    }
  }

  if ((messages.length === 0) && (!options.background)) {
    if (fights_data.length === 0) {
      messages.push("Failed to get data");
    } else {
      messages.push("All heroes are tied right now");
    }
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
  const hero_name = hero_name_args.map(x => util.getCleanName(x)).join(" ");
  const hero_role_name = util.getRoleNameFromHeroName(hero_name);
  return channel.guild.roles.cache.find(role => role.name === hero_role_name);
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
