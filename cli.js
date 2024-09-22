#!/usr/bin/env node

const { execSync } = require('child_process');

const command = process.argv[2];

if (command === 'start') {
  execSync('npm run start', { stdio: 'inherit' });
} else if (command === 'register') {
  execSync('npm run register', { stdio: 'inherit' });
} else {
  console.log('Unknown command');
}
