const cheerio = require("cheerio");
const util = require("./util.js");
const config = require("../config.json");
const moment = require("moment-timezone");
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

function saveData(key, value, noExpire=false) {
  if (noExpire) {
    cache.put(key, value);
    return;
  }
  cache.put(key, value, ms_till_next_hour());
}

function getGauntletHtml() {
  const KEY = "raw_html";
  const cached_data = getCachedData(KEY);
  if (cached_data) return new Promise(resolve => resolve(cached_data));

  return rp(config.VG_URL).then(html => {
    saveData(KEY, html);
    return html;
  });
}

function getHeroDataFromContainerDivs(container_divs) {
  const heroes_data = [];
  /**
     * Get name
     * container_div > last div > first div > first p tag has the name
     */
  const heroes_names = container_divs.find('div:last-child > div > p.name');

  for (let i = 0; i < container_divs.length; i++) {
    const key = i.toString();
    const container_div = container_divs[key];
    // Get ID and status
    const classAtrribs = container_div.attribs.class.split(' ').pop().split('-');
    const heroId = classAtrribs[2];
    /**
     * Status codes
     * true -> Normal
     * false -> losing
     * The only way to tell if a hero is winning is by
     * comparing both their statuses
     */
    const isNormal = classAtrribs[3] === 'normal' ? true : false;

    // Set get name
    const raw_name = heroes_names[key].children[0].data;
    const name = util.getCleanName(raw_name);
    const hero_data = {
      id: heroId,
      isNormal: isNormal,
      name,
      displayName: name
    };
    setHeroDisplayName(hero_data);
    heroes_data.push(hero_data);
  }

  return heroes_data;
}

function createFightData(fight_heroes_data) {
  const [first_hero, second_hero] = fight_heroes_data;
  // Assume first hero is losing
  const fight = {
    hasMultiplier: true,
    losingHero: first_hero,
    winningHero: second_hero,
  };

  // Fix the data if second hero is losing instead
  if (second_hero.isNormal === false) {
    fight.losingHero = second_hero;
    fight.winningHero = first_hero;
  } else if (first_hero.isNormal === true) {
  // In this case, this round is a tie
    fight.hasMultiplier = false;
  }

  return fight;
}

function setHeroDisplayName(hero_data) {
  const id = hero_data.id;
  const displayName = config.DISPLAY_NAMES[id];
  if (displayName !== undefined) {
    hero_data.displayName = util.getCleanName(displayName);
  }
}

function extractCurrentBattlesData(html) {
  /**
   * We can figure out the status just from reading the CSS classes
   * Returns list of fight objects
   * each fight object defines the outcome and heroes in it
   * Fight: {
   *   hasMultiplier: boolean,
   *   winningHero: Hero,
   *   losingHero: Hero,
   * }
   *
   * Hero: {
   *   name: string,
   *   displayName: string,
   *   id: string,
   *   isNormal: string,
   * }
   */
  const $ = cheerio.load(html);
  const container_divs = $(config.ALL_HEROES_DIV_SELECTOR_R1);
  const heroes_data = getHeroDataFromContainerDivs(container_divs);
  const num_fights = container_divs.length / 2;
  let fights_data = [];
  for (let fight_no = 0; fight_no < num_fights; fight_no++) {
    const base_offset = fight_no * 2;
    const fight_heroes_data = [heroes_data[base_offset], heroes_data[base_offset + 1]];
    fights_data.push(createFightData(fight_heroes_data));
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

  const getHeroesNames = (round_no) => {
    let heroesContainerSelecter = config.ALL_HEROES_DIV_SELECTOR
    if ([-1, 1].includes(round_no)) {
      // Data extraction method for round 1 works for pre round 1 too
      if (round_no === -1) {
        console.log('Fetching data before round 1');
      } else {
        console.log("Getting data for round 1");
      }
      heroesContainerSelecter = config.ALL_HEROES_DIV_SELECTOR_R1;
    }
    const $ = cheerio.load(html);
    const container_divs = $(heroesContainerSelecter);
    const heroes_data = getHeroDataFromContainerDivs(container_divs);
    return heroes_data.map(hero_data => hero_data.displayName);
  }

  /* If we are checking about 14 hours before voting starts the names are up */
  if (!util.getEventStarted()) {
    /* Check how many hours till event starts */
    let pre_fetch_heroes = config.PRE_FETCH_HEROES === 'true';
    if (pre_fetch_heroes === false) {
      const vgStartTime = moment(config.VG_START_TIME);
      const now = moment();
      const hoursTillVgStarts = vgStartTime.diff(now, 'hours');
      pre_fetch_heroes = hoursTillVgStarts <= 14;
    }

    if (pre_fetch_heroes) {
      return getHeroesNames(-1);
    }
  }

  /* Otherwise create data only if battles are on */
  [_, battles_on, round_no] = util.isBattleAvailable();
  if (!battles_on) {
    console.log('waiting for fights to start')
    return [];
  }


  return getHeroesNames(round_no);
}

function getAllHeroesNames() {
  const KEY = "all_heroes_names";
  const cached_data = getCachedData(KEY);
  if (cached_data) return new Promise(resolve => resolve(cached_data));

  return getGauntletHtml().then(html => {
    const heroes_names = extractAllHeroesNames(html);
      if (heroes_names.length === 8) {
        saveData(KEY, heroes_names, true);
      }
      return heroes_names;
  });
}

module.exports = {
  getCurrentBattlesData: getCurrentBattlesData,
  getAllHeroesNames: getAllHeroesNames
}
