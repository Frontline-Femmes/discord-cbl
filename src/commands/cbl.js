const { SlashCommandBuilder, ThreadAutoArchiveDuration, EmbedBuilder } = require('discord.js');
const { getCBLHistory } = require('../utils/cblApi');
const logger = require('../utils/logger').default;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cbl')
    .setDescription('Fetch CBL history for a SteamID')
    .addStringOption((option) =>
      option.setName('steamid').setDescription('The SteamID of the player').setRequired(true)
    ),
  async execute(interaction) {
    const steamId = interaction.options.getString('steamid');
    logger.info(`Received command: cbl from ${interaction.user.tag}`);
    logger.debug(`Processing /cbl command for SteamID: ${steamId}`);

    try {
      await interaction.deferReply();
      logger.debug(`Deferred reply for SteamID: ${steamId}`);

      const user = await getCBLHistory(steamId);

      if (!user) {
        logger.warn(`No data found for SteamID: ${steamId}`);
        await interaction.editReply(`No data found for SteamID: ${steamId}`);
        return;
      }

      // Construct the CBL user page link
      const cblLink = `https://communitybanlist.com/search/${steamId}`;

      // Create the main embed message
      const embed = new EmbedBuilder()
        .setColor(0xffc40b)
        .setTitle(`CBL History for ${user.name || steamId}`)
        .setURL(cblLink)
        .setThumbnail(user.avatarFull || null)
        .addFields(
          { name: 'Reputation Points', value: `${user.reputationPoints || 0}`, inline: true },
          { name: 'Risk Rating', value: `${user.riskRating || 0}/10`, inline: true },
          {
            name: 'Active Bans',
            value: `${user.activeBans.edges.length}`,
            inline: true
          },
          {
            name: 'Expired Bans',
            value: `${user.expiredBans.edges.length}`,
            inline: true
          }
        )
        .setTimestamp();

      // Function to create paginated embeds
      function createPaginatedEmbeds(banArray, title) {
        const pages = [];
        const bansPerPage = 3;
        for (let i = 0; i < banArray.length; i += bansPerPage) {
          const currentBans = banArray.slice(i, i + bansPerPage);
          const embed = new EmbedBuilder().setTitle(title).setColor(0xff0000).setTimestamp();

          currentBans.forEach((ban) => {
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
        const activeBanPages = createPaginatedEmbeds(
          user.activeBans.edges.map((edge) => edge.node),
          `Active Bans for ${user.name || steamId}`
        );

        const activeThread = await interaction.channel.threads.create({
          name: `Active Bans for ${user.name || steamId}`,
          autoArchiveDuration: ThreadAutoArchiveDuration.OneHour
        });

        for (const page of activeBanPages) {
          await activeThread.send({ embeds: [page] });
        }
      }

      // Send expired bans in a thread
      if (user.expiredBans && user.expiredBans.edges.length > 0) {
        const expiredBanPages = createPaginatedEmbeds(
          user.expiredBans.edges.map((edge) => edge.node),
          `Expired Bans for ${user.name || steamId}`
        );

        const expiredThread = await interaction.channel.threads.create({
          name: `Expired Bans for ${user.name || steamId}`,
          autoArchiveDuration: ThreadAutoArchiveDuration.OneHour
        });

        for (const page of expiredBanPages) {
          await expiredThread.send({ embeds: [page] });
        }
      } else {
        logger.debug(`No expired bans to display for SteamID: ${steamId}`);
      }
    } catch (error) {
      logger.error(`Error processing /cbl command: ${error.message}`, { error });
      if (!interaction.replied) {
        await interaction.editReply('Error fetching CBL history.');
      }
    }
  }
};
