// Testing without this line. Docker envorinment variables are called in Portainer.
//require('dotenv').config();
const config = require('config');
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const logger = require('./utils/logger');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel]
});

client.commands = new Collection();

// Load command files
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  client.commands.set(command.data.name, command);
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error(`Error executing command: ${error.message}`, { error });
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({
        content: 'There was an error executing that command.',
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: 'There was an error executing that command.',
        ephemeral: true
      });
    }
  }
});

client.once('ready', () => {
  logger.info(`Bot logged in as ${client.user.tag}`);
});

client.on('error', (error) => {
  logger.error(`Client error: ${error.message}`);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise} - reason: ${reason}`);
});

// Prioritize environment variables, fall back to config
const token = process.env.DISCORD_TOKEN || config.get('discordToken');
// eslint-disable-next-line no-unused-vars
const clientId = process.env.DISCORD_CLIENT_ID || config.get('clientId');

client.login(token).catch((error) => {
  logger.error(`Failed to login: ${error.message}`);
});
