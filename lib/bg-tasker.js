const util = require("./util.js");
const vg = require("./vg-helper");
const scraper = require("./scraper");
const config = require("../config.json");
const events = require("events");

let BG_INTERVAL, ALL_HEROES_ROLES_TIMER, VG_CHANNELS_TIMER, ARMY_ROLES;

const eventEmitter = new events.EventEmitter();

function showGauntletStatusBg(client) {
  if (util.getEventEnded()) {
    /* Stop announcement task if event ended */
    clearInterval(BG_INTERVAL);
    return;
  }
  let [_, battles_on, round_number] = util.isBattleAvailable();
  if (battles_on) {
    const guild = client.guilds.get(process.env.VG_BOT_SERVER_ID);
    const announce_channel = guild.channels.find(channel => channel.name === config.ANNOUNCEMENT_CHANNEL);
    const options = {
      multiplier_only: true,
      background: true,
      mention_army: true,
      channel: announce_channel
    }
    vg.getCurrentBattlesMessages(round_number, options).then(msgs => {
      for (msg of msgs) {
        util.sendAnnouncement(client, msg);
      }
    });
  }
}

function startVgTimer(client) {
  const ms_in_hour = 60 * 60 * 1000;
  BG_INTERVAL = setInterval(showGauntletStatusBg, ms_in_hour, client);
  showGauntletStatusBg(client);
}

function setupVotingGauntletTimer(client) {
  // offset by 5 minutes in case website is late to update
  const milliseconds_left = util.getMsTillNextHour() + 5 * 60 * 1000;
  setTimeout(startVgTimer, milliseconds_left, client);
}

function createArmyRolesAllHereos(client) {
  console.log("Trying to create army roles");
  /* Get guild/server object */
  let guild = client.guilds.get(process.env.VG_BOT_SERVER_ID);

  scraper.getAllHeroesNames().then(async all_heroes_names => {
    /* Failed to get hero names, wait for later */
    if (all_heroes_names.length < 8) {
      console.log(`Failed: Got only ${all_heroes_names.length} results`)
      return;
    }
    console.log("Successfully got all names");

    /* Convert hero names into role names */
    role_names = all_heroes_names.map(name => util.getRoleNameFromHeroName(name));
    /* Save all roles for armies */
    army_roles = [];
    for (army_role_name of role_names) {
      /* Get role if already exists */
      let army_role = guild.roles.find(x => x.name === army_role_name);
      if (army_role) {
        /* Make role mentionable just to be sure */
        console.log(`Role ${army_role_name} already exists. Proceeding to changing permissions`);
        army_role.setMentionable(true);
      } else {
        /* Create role if it doesn't exist */
        /* Proceed only if we have the right permissions */
        if (!guild.me.hasPermission("MANAGE_ROLES")) {
          console.log("Waiting for MANAGE_ROLES permission to be granted");
          return;
        }
        console.log(`Created role ${army_role_name}`);

        /* New roles have same permissions as @everyone automatically */
        army_role = await guild.createRole({
          name: army_role_name,
          mentionable: true,
        }).catch(err => {
          // Log the error and try again later
          console.log(err);
          return;
        });
      }
      army_roles.push(army_role);
    }
    /* Save all roles for later */
    ARMY_ROLES = army_roles;
    /* Stop repeating this task since we are done */
    clearInterval(ALL_HEROES_ROLES_TIMER);
    /* Signal that roles have been created */
    eventEmitter.emit('ARMY_ROLES_CREATED');
  });
}

function setupArmyRolesAllHeroes(client) {
  /* Retry every 10 minutes */
  const retry_dur_in_ms = 10 * 60 * 10000;
  ALL_HEROES_ROLES_TIMER = setInterval(createArmyRolesAllHereos, retry_dur_in_ms, client);
  createArmyRolesAllHereos(client);
}

async function createVgBotChannel(client) {
  /* Get or create announcements channel */
  const guild = client.guilds.get(process.env.VG_BOT_SERVER_ID);
  /* Proceed only if we have the right permissions */
  if (!guild.me.hasPermission("MANAGE_CHANNELS")) {
    console.log("Waiting for MANAGE_CHANNELS permission to be granted");
    return;
  }

  let announce_channel = guild.channels.find(x => x.name === config.ANNOUNCEMENT_CHANNEL);
  if (!announce_channel) {
    /* Create channel first */
    announce_channel = await guild.createChannel(config.ANNOUNCEMENT_CHANNEL).catch(console.log);
    console.log(`Created announcements channel #${config.ANNOUNCEMENT_CHANNEL}`);
  } else {
    console.log("Announcements channel already exists. Attempting to change permissions");
  }

  /* Set permissions for the channel */

  /* Make channel invisible to normal users */
  const everyone_role = guild.roles.find(x => x.name === '@everyone');
  announce_channel.overwritePermissions(everyone_role, {'VIEW_CHANNEL': false});

  /* Make channel read only for special roles */
  const battle_hero_roles_permissions = {
    'VIEW_CHANNEL': true,
    'SEND_MESSAGES': false,
    'ATTACH_FILES': false,
    'ADMINISTRATOR': false,
    'SEND_TTS_MESSAGES': false,
    'MANAGE_ROLES': false,
    'MANAGE_NICKNAMES': false,
    'READ_MESSAGE_HISTORY': true,
    'KICK_MEMBERS': false,
    'BAN_MEMBERS': false,
    'MANAGE_CHANNELS': false,
    'ADD_REACTIONS': true,
    'MANAGE_MESSAGES': false,
  };
  for (hero_role of ARMY_ROLES) {
    announce_channel.overwritePermissions(hero_role, battle_hero_roles_permissions);
  }

  /* Add bot itself to the channel */
  announce_channel.overwritePermissions(client.user, {
    'VIEW_CHANNEL': true,
    'SEND_MESSAGES': true,
    'ATTACH_FILES': true,
    'ADMINISTRATOR': true,
    'MANAGE_ROLES': true,
    'MANAGE_NICKNAMES': true,
    'READ_MESSAGE_HISTORY': true,
    'MANAGE_CHANNELS': true,
    'ADD_REACTIONS': true,
    'MANAGE_MESSAGES': true,
  });

  /* Stop repeating task */
  clearInterval(VG_CHANNELS_TIMER);

  /* Signal task completion */
  eventEmitter.emit('ANNOUNCEMENT_CHANNEL_READY');
}

function setupVgBotChannel(client) {
  /* Retry every 10 seconds */
  VG_CHANNELS_TIMER = setInterval(createVgBotChannel, 10 * 1000, client);
  createVgBotChannel(client);
}

function setupBackgroundTasks(client) {
  console.log("Starting background tasks");
  /* Create channel only after roles have been created */
  eventEmitter.on('ARMY_ROLES_CREATED', _ => setupVgBotChannel(client));
  /* Start announcement background task after channel has been created */
  eventEmitter.on('ANNOUNCEMENT_CHANNEL_READY', _ => setupVotingGauntletTimer(client));
  /* Start with creating roles first */
  setupArmyRolesAllHeroes(client);
}

module.exports = {
  setupBackgroundTasks: setupBackgroundTasks,
}