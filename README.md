# discord-cbl

## Overview

`discord-cbl` is a Discord bot designed to check the Squad Community Ban List (CBL) history for a given SteamID. The bot uses GraphQL to fetch data from the Community Ban List and provides detailed information about a user's reputation, risk rating, and ban history.

## Features

- 🚀 Fetch CBL history for any SteamID with lightning speed
- 🌟 Display reputation points, risk rating, risk ranking, and active/expired ban counts
- 🔒 Show both active and expired bans with detailed information
- 🧵 Automatically create a thread for expired bans to keep your channels organized


## Discord Server Installation

(Link TBD)
2. Upon adding the bot to your server, make sure the bot has permissions to send messages and create threads in the channel it's added to.

## Commands

### /cbl

Fetch the CBL history for a given SteamID:

- **steamid**: The SteamID of the player (required)

Example:
![image](https://github.com/user-attachments/assets/81355a1e-8759-4792-acd3-d926cc04504f)


## Developer Installation

1. **Clone the repository:**
   ```sh
   git clone https://github.com/sceboucher/discord-cbl.git
   cd discord-cbl
   ```

2. **Install dependencies:**
   ```sh
   npm install
   ```

3. **Configure your environment:**
   Create a `.env` file in the root directory and add your Discord bot token:
   ```env
   DISCORD_TOKEN=your_discord_bot_token
   ```

## Usage

1. **Register the bot commands:**
   ```sh
   npm run register
   ```

2. **Start the bot:**
   ```sh
   npm start
   ```

