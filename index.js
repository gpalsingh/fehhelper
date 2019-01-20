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

  if(command === "say") {
    // makes the bot say something and delete the message. As an example, it's open to anyone to use.
    // To get the "message" itself we join the `args` back into a string with spaces:
    const sayMessage = args.join(" ");
    // Then we delete the command message (sneaky, right?). The catch just ignores the error with a cute smiley thing.
    message.delete().catch(O_o=>{});
    // And we get the bot to say the thing:
    message.channel.send(sayMessage);
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
      msg = "You need to specify full name of the hero you want to follow";
      msg += `\nExample: ${config.prefix}follow black knight`;
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
      msg = "You need to specify full name of the hero you want to unfollow";
      msg += `\nExample: ${config.prefix}unfollow black knight`;
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
});

client.login(process.env.FEH_VG_HELPER_TOKEN);