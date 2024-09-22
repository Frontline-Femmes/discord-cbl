require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ThreadAutoArchiveDuration } = require('discord.js');
const { GraphQLClient, gql } = require('graphql-request');
const winston = require('winston');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
});

// Configure Winston logger
const logger = winston.createLogger({
  level: 'debug', // Set the logging level
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [new winston.transports.Console()],
});

// Function to fetch CBL history using GraphQL
async function getCBLHistory(steamId) {
  const endpoint = 'https://communitybanlist.com/graphql';
  const graphQLClient = new GraphQLClient(endpoint);

  const query = gql`
    query GetSteamUser($id: String!) {
      steamUser(id: $id) {
        id
        name
        avatarFull
        reputationPoints
        riskRating
        reputationRank
        activeBans: bans(orderBy: "created", orderDirection: DESC, expired: false) {
          edges {
            node {
              id
              created
              expires
              reason
              banList {
                name
                organisation {
                  name
                  discord
                }
              }
            }
          }
        }
        expiredBans: bans(orderBy: "created", orderDirection: DESC, expired: true) {
          edges {
            node {
              id
              created
              expires
              reason
              banList {
                name
                organisation {
                  name
                  discord
                }
              }
            }
          }
        }
      }
    }
  `;

  logger.debug(`Fetching CBL history for SteamID: ${steamId}`);
  try {
    const data = await graphQLClient.request(query, { id: steamId });
    logger.debug(`Received response for SteamID: ${steamId}`);
    return data.steamUser;
  } catch (error) {
    logger.error(`Error fetching CBL history for SteamID: ${steamId}: ${error.message}`);
    throw new Error('Failed to fetch CBL history.');
  }
}

// Function to map risk rating to a readable format
function getRiskRatingLabel(riskRating) {
  switch (riskRating) {
    case 0:
      return 'None';
    case 1:
      return 'Low';
    case 2:
      return 'Medium';
    case 3:
      return 'High';
    case 4:
      return 'Extreme';
    default:
      return 'Unknown';
  }
}

// Handle slash commands
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  logger.info(`Received command: ${interaction.commandName} from ${interaction.user.tag}`);

  if (interaction.commandName === 'cbl') {
    const steamId = interaction.options.getString('steamid');
    logger.debug(`Processing /cbl command for SteamID: ${steamId}`);

    try {
      await interaction.deferReply();
      logger.debug(`Deferred reply for SteamID: ${steamId}`);

      const user = await getCBLHistory(steamId);

      if (!user) {
        logger.warn(`No data found for SteamID: ${steamId}`);
        await interaction.editReply('No data found for this SteamID.');
        return;
      }

      // Construct the CBL user page link
      const cblLink = `https://communitybanlist.com/search/${steamId}`;


      // Create an embed message
      const embed = {
        color: 0xffc40b,
        title: `CBL History for ${user.name || steamId}`,
        url: cblLink,
        thumbnail: { url: user.avatarFull || null },
        fields: [
          {
            name: 'Reputation Points',
            value: `${user.reputationPoints || 0}/10`,
            inline: true,
          },
          {
            name: 'Risk Rating',
            value: getRiskRatingLabel(user.riskRating),
            inline: true,
          },
          {
            name: 'Risk Ranking',
            value: user.reputationRank ? `#${user.reputationRank}` : 'Unranked',
            inline: true,
          },
          {
            name: 'Active Bans',
            value: `${user.activeBans.edges.length}`,
            inline: true,
          },
          {
            name: 'Expired Bans',
            value: `${user.expiredBans.edges.length}`,
            inline: true,
          },
        ],
        timestamp: new Date(),
      };

      // Prepare Active Bans
      if (user.activeBans && user.activeBans.edges.length > 0) {
        embed.fields.push({
          name: `Active Bans (${user.activeBans.edges.length})`,
          value: user.activeBans.edges
            .map((edge) => {
              const ban = edge.node;
              return `**Ban ID**: ${ban.id}
**Reason**: ${ban.reason || 'No reason provided'}
**Organization**: [${ban.banList.organisation.name}](${ban.banList.organisation.discord || ''})
**Ban List**: ${ban.banList.name}
**Created**: ${new Date(ban.created).toLocaleDateString()}
**Expires**: ${
                ban.expires ? new Date(ban.expires).toLocaleDateString() : 'Never'
              }`;
            })
            .join('\n\n'),
        });
      } else {
        embed.fields.push({
          name: 'Active Bans',
          value: 'No active bans.',
        });
      }

      const message = await interaction.editReply({ embeds: [embed] });
      logger.info(`Sent CBL history to ${interaction.user.tag} for SteamID: ${steamId}`);

      // Create a thread for expired bans
      if (user.expiredBans && user.expiredBans.edges.length > 0) {
        const thread = await message.startThread({
          name: `Expired Bans for ${user.name || steamId}`,
          autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
        });
        logger.debug(`Created thread for expired bans: ${thread.id}`);

        // Prepare expired bans content
        const expiredBansContent = user.expiredBans.edges
          .map((edge) => {
            const ban = edge.node;
            return `**Ban ID**: ${ban.id}
**Reason**: ${ban.reason || 'No reason provided'}
**Organization**: [${ban.banList.organisation.name}](${ban.banList.organisation.discord || ''})
**Ban List**: ${ban.banList.name}
**Created**: ${new Date(ban.created).toLocaleDateString()}
**Expired On**: ${
              ban.expires ? new Date(ban.expires).toLocaleDateString() : 'Unknown'
            }`;
          })
          .join('\n\n');

        // Send the expired bans in the thread
        await thread.send(expiredBansContent);
        logger.info(`Posted expired bans in thread for ${interaction.user.tag}`);
      } else {
        logger.debug(`No expired bans to display for SteamID: ${steamId}`);
      }
    } catch (error) {
      logger.error(`Error processing /cbl command: ${error.message}`);
      await interaction.editReply('Error fetching CBL history.');
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

client.login(DISCORD_TOKEN).catch((error) => {
  logger.error(`Failed to login: ${error.message}`);
});