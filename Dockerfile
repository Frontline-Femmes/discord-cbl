FROM node:22.6.0-slim

WORKDIR /opt/workdir

# Test to make sure packages are up to date
RUN apt update && apt upgrade -y

# Copy the service across
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
