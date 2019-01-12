const cheerio = require("cheerio");
const util = require("./util.js");
const config = require("../config.json");
const moment = require("moment-timezone");
const latinize = require("latinize");
const rp = require("request-promise");

moment.tz.setDefault(config.JP_TIME_ZONE);
let UPDATE_LOGS = {};
let CACHED_DATA = {};

function isDataNew(key) {
  /* The timezone needs to be JST */
  const last_update = UPDATE_LOGS[key];
  if (!last_update) return false;

  const time_now = moment();
  const hour_changed = last_update.hours() !== time_now.hours();
  if (hour_changed) return false;

  /* Edge case: Same hour but different days */
  const day_changed = last_update.days() !== time_now.days();
  if (day_changed) return false;

  return true;
}

function getCachedData(key) {
  if (!isDataNew(key)) {
    return false;
  }
  return CACHED_DATA[key];
}

function saveData(key, value) {
  UPDATE_LOGS[key] = moment();
  CACHED_DATA[key] = value;
}

function getGauntletHtml() {
  const KEY = "raw_html";
  const cached_data = getCachedData(KEY);
  if (cached_data) new Promise(resolve => resolve(cached_data));

  return rp(config.VG_URL).then(html => {
    console.log("getting data");
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
      hero_data["score"] = BigInt(util.numberWithoutCommas(score));
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
exports.getCurrentBattlesData = getCurrentBattlesData;
