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
    
    // Create backup of wrangler.toml
    const backupPath = wranglerPath + '.backup-' + Date.now();
    fs.writeFileSync(backupPath, content);
    console.log(`💾 Created backup: ${path.basename(backupPath)}`);
    
    // Show current schedule
    const currentMatch = content.match(/crons\s*=\s*\[\s*"([^"]*)"\s*\]/);
    if (currentMatch) {
      console.log(`📊 Current schedule: ${currentMatch[1]}`);
    }
    
    // Update the crons line with more robust regex
    const cronRegex = /crons\s*=\s*\[\s*"[^"]*"\s*\]/;
    const newCronLine = `crons = ["${schedule}"]`;
    
    if (cronRegex.test(content)) {
      const oldContent = content;
      content = content.replace(cronRegex, newCronLine);
      
      // Verify the change was made
      if (content === oldContent) {
        console.error('Failed to update schedule - content unchanged');
        process.exit(1);
      }
      
      fs.writeFileSync(wranglerPath, content);
      
      console.log('✅ Updated wrangler.toml successfully');
      console.log(`📅 New schedule: ${schedule}`);
      console.log('🚀 Run "npm run deploy" to apply changes');
      
      // Also update POST_FREQUENCY in environment sections to keep consistency
      const postFreqRegex = /POST_FREQUENCY\s*=\s*"[^"]*"/g;
      content = content.replace(postFreqRegex, `POST_FREQUENCY = "${schedule}"`);
      
      // Write the updated content again
      fs.writeFileSync(wranglerPath, content);
      
      // Verify the update by reading the file again
      const verifyContent = fs.readFileSync(wranglerPath, 'utf8');
      const verifyMatch = verifyContent.match(/crons\s*=\s*\[\s*"([^"]*)"\s*\]/);
      if (verifyMatch && verifyMatch[1] === schedule) {
        console.log(`✅ Verified: Schedule is now ${verifyMatch[1]}`);
        
        // Check if POST_FREQUENCY was also updated
        const postFreqMatches = verifyContent.match(/POST_FREQUENCY\s*=\s*"([^"]*)"/g);
        if (postFreqMatches) {
          console.log(`✅ Updated ${postFreqMatches.length} POST_FREQUENCY entries`);
        }
      } else {
        console.warn(`⚠️ Warning: Expected "${schedule}" but file contains "${verifyMatch ? verifyMatch[1] : 'not found'}"`);
      }
      
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