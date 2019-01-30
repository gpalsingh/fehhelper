const util = require("./lib/util.js");

// Load up the discord.js library
const Discord = require("discord.js");

// This is your client. Some people call it `bot`, some people call it `self`,
// some might call it `cootchie`. Either way, when you see `client.something`, or `bot.something`,
// this is what we're refering to. Your client.
const client = new Discord.Client();

// Here we load the config.json file that contains our token and our prefix values.
const config = require("./config.json");
// config.token contains the bot's token
// config.prefix contains the message prefix.

const vg_helper = require("./lib/vg-helper.js");
const bg_announcer = require("./lib/bg-tasker.js");
const scraper = require("./lib/scraper.js");

const USAGE_TEXT = {
  vg: "```" + config.prefix + "vg```",
  follow: "```" + config.prefix + "follow black knight```",
  unfollow: "```" + config.prefix + "unfollow black knight```",
  heroes: "```" + config. prefix + "heroes```",
}

const HELP_TEXT = {
  vg: "Get current voting gauntlet status",
  follow: "Follow hero to receive multiplier notifications. Use full name of hero",
  unfollow: "Unfollow hero to stop receiving multiplier notifications. Use full name of hero",
  heroes: "Get a list of all the heroes in the current voting gauntlet",
}

client.on("ready", () => {
  // This event will run if the bot starts, and logs in, successfully.
  console.log(`Bot has started, with ${client.users.size} users, in ${client.channels.size} channels of ${client.guilds.size} guilds.`);
  // Example of changing the bot's playing game to something useful. `client.user` is what the
  // docs refer to as the "ClientUser".
  client.user.setActivity("FEH");
  if (!util.getEventEnded()) {
    bg_announcer.setupBackgroundTasks(client);
  }
});

client.on("message", async message => {
  // This event will run on every single message received, from any channel or DM.

  // It's good practice to ignore other bots. This also makes your bot ignore itself
  // and not get into a spam loop (we call that "botception").
  if(message.author.bot) return;

  // Also good practice to ignore any message that does not start with our prefix,
  // which is set in the configuration file.
  if(message.content.indexOf(config.prefix) !== 0) return;

  // Here we separate our "command" name, and our "arguments" for the command.
  // e.g. if we have the message "!say Is this the real life?" , we'll get the following:
  // command = say
  // args = ["Is", "this", "the", "real", "life?"]
  const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();

  if(command === "ping") {
    // Calculates ping between sending a message and editing it, giving a nice round-trip latency.
    // The second ping is an average latency between the bot and the websocket server (one-way, not round-trip)
    const m = await message.channel.send("Ping?");
    m.edit(`Pong! Latency is ${m.createdTimestamp - message.createdTimestamp}ms. API Latency is ${Math.round(client.ping)}ms`);
  }

  if(command === "vg") {
    const m = await message.channel.send("Calculating results. Please wait");
    vg_helper.getGauntletStatusMessage().then(reply => {
      m.edit(reply);
    });
  }

  if(command === "follow") {
    const author = message.member;
    if (!author) {
      /* Author is no longer member of guild */
      return;
    }

    /* Check if hero name is given */
    if (args.length === 0) {
      let msg = HELP_TEXT.follow + "\nUsage:" + USAGE_TEXT.follow;
      message.channel.send(msg);
      return;
    }

    /* Check if role for name exists */
    const hero_name_args = args;
    const hero_role = vg_helper.getRoleFromHeroName(message.channel, hero_name_args);
    if (!hero_role) {
      message.channel.send(`Couldn't find ${hero_name_args.join(" ")} in current gauntlet`);
      return;
    }

    /* Give role to user */
    author.addRole(hero_role).then(_ => {
      message.channel.send(`${author} you have now joined ${hero_role}`);
    }).catch(err => {
      message.channel.send(`Failed to set role for ${author}`);
      console.log(err);
    })
  }

  if(command === "unfollow") {
    const author = message.member;
    if (!author) {
      /* Author is no longer member of guild */
      return;
    }

    /* Check if hero name was given */
    if (args.length === 0) {
      let msg = HELP_TEXT.unfollow + "\nUsage:" + USAGE_TEXT.unfollow;
      message.channel.send(msg);
      return;
    }

    /* Check role exists */
    const hero_name_args = args;
    const hero_role = vg_helper.getRoleFromHeroName(message.channel, hero_name_args);
    if (!hero_role) {
      message.channel.send(`Couldn't find ${hero_name_args.join(" ")} in current gauntlet`);
      return;
    }

    /* Remove role from user */
    author.removeRole(hero_role).then(_ => {
      message.channel.send(`${author} you have successfully left ${hero_role}`);
    }).catch(err => {
      message.channel.send(`Failed to remove role for ${author} :(`);
      console.log(err);
    });
  }

  /* List all heroes in current gauntlet */
  if(command === "heroes") {
    scraper.getAllHeroesNames().then(heroes_names => {
      if (heroes_names.length < 8) {
        message.channel.send("Sorry, I was unable to get the list. Please try again later").catch(_=>{});
        return;
      }

      let msg = "Following are the heroes in current voting gauntlet```";
      msg += heroes_names.join("\n");
      msg += "```";

      message.channel.send(msg);
    });
  }

  if(command === "help") {
    /* List available commands if no command specified */
    if (args.length === 0) {
      let msg = "Usage: ```" + config.prefix + "help [command name]```";
      msg += "\n Following are the available commands:```";
      for (let key of Object.keys(HELP_TEXT)) {
        msg += `\n${key}`
      }
      msg +="```";
      msg += `Start with "follow" if you're new`
      message.channel.send(msg);
      return;
    }

    let help_command = args.shift();

    /* Check if command exists */
    if (!HELP_TEXT[help_command]) {
      message.channel.send(`Command ${help_command} does not exist`);
      return;
    }
    help_command = help_command.toLowerCase();

    /* Print full help message for command */
    message.channel.send(HELP_TEXT[help_command] + "\nUsage:" + USAGE_TEXT[help_command]);
  }
});

client.login(process.env.FEH_VG_HELPER_TOKEN);