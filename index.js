require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ThreadAutoArchiveDuration, EmbedBuilder } = require('discord.js');
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

      // Create the main embed message
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

      // Function to create paginated embeds
      function createPaginatedEmbeds(banArray, title) {
        const pages = [];
        const bansPerPage = 3;
        for (let i = 0; i < banArray.length; i += bansPerPage) {
          const currentBans = banArray.slice(i, i + bansPerPage);
          const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor(0xff0000)
            .setTimestamp();

          currentBans.forEach(ban => {
            const banInfo = `
**Ban ID**: ${ban.id}
**Reason**: ${ban.reason || 'No reason provided'}
**Organization**: [${ban.banList.organisation.name}](${ban.banList.organisation.discord || 'https://discord.com/'})
**Ban List**: ${ban.banList.name}
**Created**: ${new Date(ban.created).toLocaleDateString()}
**Expires**: ${ban.expires ? new Date(ban.expires).toLocaleDateString() : 'Never'}
            `;
            embed.addFields({ name: '\u200B', value: banInfo });
          });

          pages.push(embed);
        }
        return pages;
      }

      // Send the main embed in the interaction reply
      await interaction.editReply({ embeds: [embed] });

      // Send active bans in a thread
      if (user.activeBans && user.activeBans.edges.length > 0) {
        const activeBanPages = createPaginatedEmbeds(user.activeBans.edges.map(edge => edge.node), `Active Bans for ${user.name || steamId}`);

        const activeThread = await interaction.channel.threads.create({
          name: `Active Bans for ${user.name || steamId}`,
          autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
        });

        for (const page of activeBanPages) {
          await activeThread.send({ embeds: [page] });
        }
      }

      // Send expired bans in a thread
      if (user.expiredBans && user.expiredBans.edges.length > 0) {
        const expiredBanPages = createPaginatedEmbeds(user.expiredBans.edges.map(edge => edge.node), `Expired Bans for ${user.name || steamId}`);

        const expiredThread = await interaction.channel.threads.create({
          name: `Expired Bans for ${user.name || steamId}`,
          autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
        });

        for (const page of expiredBanPages) {
          await expiredThread.send({ embeds: [page] });
        }
      } else {
        logger.debug(`No expired bans to display for SteamID: ${steamId}`);
      }
    } catch (error) {
      logger.error(`Error processing /cbl command: ${error.message}`);
      if (!interaction.replied) {
        await interaction.editReply('Error fetching CBL history.');
      }
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