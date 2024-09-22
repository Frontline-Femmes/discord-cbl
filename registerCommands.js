require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { ApplicationCommandOptionType } = require('discord-api-types/v9');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = '1279428592777822219';

const commands = [
  {
    name: 'cbl',
    description: 'Fetch CBL history for a SteamID',
    options: [
      {
        name: 'steamid',
        type: ApplicationCommandOptionType.String,
        description: 'The SteamID of the player',
        required: true,
      },
    ],
  },
];

const rest = new REST({ version: '9' }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();