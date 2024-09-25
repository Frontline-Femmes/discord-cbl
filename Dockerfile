FROM debian:bookworm-slim

WORKDIR /opt/workdir

# Test to make sure packages are up to date
RUN apt update && apt upgrade -y

RUN apt install -y curl
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh
RUN nvm install v22.6.0
RUN npm install -g npm@latest

# Testing tailscale setup
# RUN apt install -y curl
# RUN curl -fsSL https://tailscale.com/install.sh | sh

# Copy the folders needed for the service
COPY src ./src
COPY config ./config

# Copy main package.json
COPY package.json .

# Install dependencies
RUN npm i --omit-dev

# Install pm2
RUN npm i pm2 -g

# Run service
CMD [ "pm2-runtime", "src/index.js" ]
