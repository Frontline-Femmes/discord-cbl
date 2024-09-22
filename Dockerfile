FROM node:22.6.0-slim

WORKDIR /opt/workdir

# Test to make sure packages are up to date
RUN apt update && apt upgrade -y

# Copy the core directory to the workdir
COPY . ./

# Copy .env file
COPY .env .env

# Install dependencies
RUN npm i --production

# Install pm2
RUN npm i pm2 -g

# Run service
CMD [ "pm2-runtime", "index.js" ]