const { GraphQLClient, gql } = require('graphql-request');
const config = require('config');
const logger = require('./logger');

const endpoint = config.get('graphQLEndpoint');
const client = new GraphQLClient(endpoint);

const GET_STEAM_USER = gql`
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

async function getCBLHistory(steamId) {
  try {
    const variables = { id: steamId };
    logger.debug(`Fetching CBL history for SteamID: ${steamId}`);
    const data = await client.request(GET_STEAM_USER, variables);
    logger.debug(`Received response for SteamID: ${steamId}`);
    return data.steamUser;
  } catch (error) {
    logger.error(`GraphQL request failed: ${error.message}`, { error });
    throw new Error('Failed to fetch CBL history.');
  }
}

module.exports = { getCBLHistory };
