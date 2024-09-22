require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('config');
const logger = require('./utils/logger');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  commands.push(command.data.toJSON());
}

// Prioritize environment variables, fall back to config
const token = process.env.DISCORD_TOKEN || config.get('discordToken');
const clientId = process.env.DISCORD_CLIENT_ID || config.get('clientId');

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    logger.info('Started refreshing application (/) commands.');

    await rest.put(Routes.applicationCommands(clientId), { body: commands });

    logger.info('Successfully reloaded application (/) commands.');
  } catch (error) {
    logger.error(`Error reloading commands: ${error.message}`);
  }
})();
