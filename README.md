# fehhelper

Discord bot to notifies you only when multiplier is active for an army that you support during a voting gauntlet.

## How does it work?

The bot assigns you special role depending on the army you support.
When multiplier is active the bot will notify only the losing army by simply mentioning the special role.

## How was it made?

The bot was made using a module of [Node.js](https://nodejs.org) called [discord.js](https://github.com/discordjs/discord.js/) that allows
you to interact with the [Discord API](https://discordapp.com/developers/docs/intro) very easily.

## Configuration
`config.json` has most of the bot configuration variables. Below are some that you might need to change:

  - **VG_URL**: Make sure it has the right gauntlet number. If current gauntlet number is 24 it should look like ".../tournaments/***24***?locale=en-US"
  - **VG_START_TIME**: Make sure it has the right starting time for round 1 in JST. The website uses anti bot functions which makes it hard to get this info automatically
  - **prefix**: The bot prefix. Change it to some other character if it clashes with other bots.
  - **ARMY_ROLE**: Template for army roles that the bot creates or uses. Replace the first "#" symbol with hero name to create role. Example: "# Army # " becomes "Fjorm Army #"
  - **ANNOUNCEMENT_CHANNEL**: Exact name of the announcements channel that the bot creates or uses
  
### Environment variables
The bot uses environment variables for some sensitive information. Setting up these variables differ with deployment methods.

  - **FEH_VG_HELPER_TOKEN**: The secret token for the bot. Not to be confused with client secret token
  - **VG_BOT_SERVER_ID**: The ID of your server.
