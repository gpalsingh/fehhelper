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

function extractAllHeroesNames(html) {
  /* Currently create data only if battles are on
     Returns array of strings */
  [_, battles_on, round_no] = util.isBattleAvailable();
  if (!battles_on) return [];

  let heroes_names = [];
  if (round_no === 1) {
    return extractCurrentBattlesData(html).then(current_fights => {
      for (fight of current_fights) {
        for (hero of fight) {
          heroes_names.push(hero['name']);
        }
      }

      return heroes_names;
    });
  } else {
    const $ = cheerio.load(html);
    const name_tags = $(config.ALL_HEROES_NAME_SELECTOR);
    for (let i = 0; i < name_tags.length; i++) {
      heroes_names.push(latinize(name_tags[i]["children"][0]["data"]));
    }
    return new Promise(resolve => resolve(heroes_names));
  }


}

function getAllHeroesNames() {
  const KEY = "all_heroes_names";
  const cached_data = getCachedData(KEY);
  if (cached_data) return new Promise(resolve => resolve(cached_data));

  return getGauntletHtml().then(html => {
    return extractAllHeroesNames(html).then(heroes_names => {
      if (heroes_names.length === 8) {
        saveData(KEY, heroes_names);
      }
      return heroes_names;
    });
  });
}

module.exports = {
  getCurrentBattlesData: getCurrentBattlesData,
  getAllHeroesNames: getAllHeroesNames
}
