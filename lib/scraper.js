const cheerio = require("cheerio");
const util = require("./util.js");
const config = require("../config.json");
const moment = require("moment-timezone");
const latinize = require("latinize");
const rp = require("request-promise");
const cache = require('memory-cache');

moment.tz.setDefault(config.JP_TIME_ZONE);

function ms_till_next_hour() {
  const now = moment();
  const next_hour_start = now.clone().add(1, 'hour').startOf('hour');
  const diff_in_ms = next_hour_start.valueOf() - now.valueOf();
  return diff_in_ms;
}

function getCachedData(key) {
  let value = cache.get(key);
  return value;
}

function saveData(key, value) {
  cache.put(key, value, ms_till_next_hour());
}

function getGauntletHtml() {
  const KEY = "raw_html";
  const cached_data = getCachedData(KEY);
  if (cached_data) new Promise(resolve => resolve(cached_data));

  return rp(config.VG_URL).then(html => {
    saveData(KEY, html);
    return html;
  });
}

function extractCurrentBattlesData(html) {
  /* Returns {[Hero: Score, Hero Score], ...other rounds} */
  const $ = cheerio.load(html);
  const all_names = $(config.CURRENT_NAME_SELECTOR);
  const all_scores = $(config.CURRENT_POINTS_SELECTOR);
  const num_fights = all_names.length / 2;
  let fights_data = [];
  for (let fight_no = 0; fight_no < num_fights; fight_no++) {
    let fight_data = [];
    const base_offset = fight_no * 2;
    for (let side = 0; side < 2; side++) {
      let hero_data = {};
      const offset = base_offset + side;
      const raw_name = all_names[offset]["children"][0]["data"];
      const name = latinize(raw_name);
      const score = all_scores[offset]["children"][0]["data"];
      hero_data["name"] = name;
      hero_data["score"] = Number(util.numberWithoutCommas(score));
      fight_data.push(hero_data);
    }
    fights_data.push(fight_data);
  }

  return fights_data;
}

function getCurrentBattlesData() {
  /* Data changes hourly so we can just serve saved data */
  const KEY = "fights_data";
  const cached_data = getCachedData(KEY);
  if (cached_data) return new Promise(resolve => resolve(cached_data));

  /* Get new data if previous data is stale */
  return getGauntletHtml().then(html => {
    const fights_data = extractCurrentBattlesData(html);
    saveData(KEY, fights_data);
    return fights_data;
  });
}

/* Returns array of strings */
function extractAllHeroesNames(html) {
  let heroes_names = [];

  /* If we are checking about 14 hours before voting starts the names are up */
  if (!util.getEventStarted()) {
    /* Check how many hours till event starts */
    const time_till_event_starts = moment(config.VG_START_TIME).valueOf() - moment().valueOf();
    const ms_in_fourteen_hours = 14 * 60 * 60 * 1000;
    if (time_till_event_starts < ms_in_fourteen_hours) {
      /* Get names of all heroes */
      console.log("Getting heroes names just before voting starts");
      const $ = cheerio.load(html);
      const all_names = $(config.PRE_VOTING_NAME_SELECTOR);

      for (let i = 0; i < all_names.length; i++) {
        let hero_name = all_names[i]["children"][0]["data"];
        heroes_names.push(latinize(hero_name));
      }

      return heroes_names;
    }
  }

  /* Otherwise create data only if battles are on */
  [_, battles_on, round_no] = util.isBattleAvailable();
  if (!battles_on) return [];

  if (round_no === 1) {
    const current_fights = extractCurrentBattlesData(html);
    for (fight of current_fights) {
      for (hero of fight) {
        heroes_names.push(hero['name']);
      }
    }

    return heroes_names;
  } else {
    const $ = cheerio.load(html);
    const name_tags = $(config.ALL_HEROES_NAME_SELECTOR);
    for (let i = 0; i < name_tags.length; i++) {
      heroes_names.push(latinize(name_tags[i]["children"][0]["data"]));
    }
    return heroes_names;
  }


}

function getAllHeroesNames() {
  const KEY = "all_heroes_names";
  const cached_data = getCachedData(KEY);
  if (cached_data) return new Promise(resolve => resolve(cached_data));

  return getGauntletHtml().then(html => {
    const heroes_names = extractAllHeroesNames(html);
      if (heroes_names.length === 8) {
        saveData(KEY, heroes_names);
      }
      return heroes_names;
  });
}

module.exports = {
  getCurrentBattlesData: getCurrentBattlesData,
  getAllHeroesNames: getAllHeroesNames
}
