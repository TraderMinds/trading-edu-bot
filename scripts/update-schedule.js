#!/usr/bin/env node
// scripts/update-schedule.js
// Helper script to update wrangler.toml cron schedule
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

async function updateSchedule() {
  try {
    const schedule = process.argv[2];
    
    if (!schedule) {
      console.error('Usage: npm run update-schedule "*/5 * * * *"');
      console.error('Example schedules:');
      console.error('  "*/5 * * * *"    - Every 5 minutes');
      console.error('  "*/10 * * * *"   - Every 10 minutes');
      console.error('  "0 * * * *"      - Every hour');
      console.error('  "0 */2 * * *"    - Every 2 hours');
      process.exit(1);
    }

    // Validate cron format (basic)
    const cronParts = schedule.split(' ');
    if (cronParts.length !== 5) {
      console.error('Invalid cron format. Expected 5 parts: minute hour day month weekday');
      process.exit(1);
    }

    const wranglerPath = path.join(__dirname, '..', 'wrangler.toml');
    
    if (!fs.existsSync(wranglerPath)) {
      console.error('wrangler.toml not found');
      process.exit(1);
    }

    let content = fs.readFileSync(wranglerPath, 'utf8');
    
    // Update the crons line
    const cronRegex = /crons = \["[^"]*"\]/;
    const newCronLine = `crons = ["${schedule}"]`;
    
    if (cronRegex.test(content)) {
      content = content.replace(cronRegex, newCronLine);
      fs.writeFileSync(wranglerPath, content);
      
      console.log('✅ Updated wrangler.toml successfully');
      console.log(`📅 New schedule: ${schedule}`);
      console.log('🚀 Run "npm run deploy" to apply changes');
      
      // Show human-readable schedule description
      const descriptions = {
        '*/5 * * * *': 'Every 5 minutes',
        '*/10 * * * *': 'Every 10 minutes',
        '*/15 * * * *': 'Every 15 minutes',
        '*/20 * * * *': 'Every 20 minutes',
        '*/30 * * * *': 'Every 30 minutes',
        '0,30 * * * *': 'Every 30 minutes (on the hour)',
        '0 * * * *': 'Every hour',
        '0 */2 * * *': 'Every 2 hours',
        '0 */4 * * *': 'Every 4 hours',
        '0 */6 * * *': 'Every 6 hours',
        '0 */12 * * *': 'Every 12 hours',
        '0 0 * * *': 'Once per day (midnight)',
        '0 9 * * *': 'Daily at 9:00 AM',
        '0 12 * * *': 'Daily at 12:00 PM',
        '0 18 * * *': 'Daily at 6:00 PM'
      };
      
      if (descriptions[schedule]) {
        console.log(`📋 Description: ${descriptions[schedule]}`);
      }
      
    } else {
      console.error('Could not find crons line in wrangler.toml');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('Error updating schedule:', error.message);
    process.exit(1);
  }
}

updateSchedule();