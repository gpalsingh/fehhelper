const cheerio = require('cheerio');
const util = require('./util.js');
const config = require('../config.json');

function extractGauntletData(html) {
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
      const name = all_names[offset]['children'][0]['data'];
      const score = all_scores[offset]['children'][0]['data'];
      hero_data['name'] = name;
      hero_data['score'] = BigInt(util.numberWithoutCommas(score));
      fight_data.push(hero_data);
    }
    fights_data.push(fight_data);
  }
  return fights_data;
}
exports.extractGauntletData = extractGauntletData;
