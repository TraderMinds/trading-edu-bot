# Schedule Management Guide

## The Issue You Experienced

When you change the schedule in the UI (e.g., from "Every hour" to "Every 5 minutes"), it only updates the schedule preference in KV storage - **it does NOT update the actual Cloudflare Worker cron triggers**.

## Why This Happens

- **UI Schedule Change** → Only stores preference in KV
- **Worker Cron Triggers** → Defined in `wrangler.toml` file
- **Result** → Worker keeps running on old schedule until `wrangler.toml` is updated

## How to Fix It

### Method 1: Manual Update (Quick Fix)

1. **Edit wrangler.toml**:
   ```toml
   [triggers]
   crons = ["*/5 * * * *"]  # Change from ["0 * * * *"]
   ```

2. **Deploy**:
   ```bash
   npm run deploy
   ```

3. **Verify**: Check deployment output shows your new schedule

### Method 2: Using Helper Script (Recommended)

Use the new automated script:

```bash
# Update to every 5 minutes
npm run update-schedule "*/5 * * * *"

# Then deploy
npm run deploy
```

### Method 3: Quick Common Schedules

```bash
# Every 5 minutes
npm run update-schedule "*/5 * * * *" && npm run deploy

# Every 15 minutes  
npm run update-schedule "*/15 * * * *" && npm run deploy

# Every hour
npm run update-schedule "0 * * * *" && npm run deploy

# Every 2 hours
npm run update-schedule "0 */2 * * *" && npm run deploy
```

## Available Schedule Options

| Cron Expression | Description | Use Case |
|----------------|-------------|----------|
| `*/5 * * * *` | Every 5 minutes | High-frequency content |
| `*/10 * * * *` | Every 10 minutes | Active engagement |
| `*/15 * * * *` | Every 15 minutes | Regular updates |
| `*/30 * * * *` | Every 30 minutes | Moderate frequency |
| `0 * * * *` | Every hour | Standard posting |
| `0 */2 * * *` | Every 2 hours | Conservative posting |
| `0 */4 * * *` | Every 4 hours | Daily highlights |
| `0 9 * * *` | Daily at 9 AM | Morning briefing |

## Verification Steps

After deploying, check:

1. **Deployment Output**: Look for `schedule: */5 * * * *` in wrangler output
2. **Cloudflare Dashboard**: Go to Workers → Your Worker → Triggers
3. **Worker Logs**: Check execution frequency matches expectation

## Enhanced UI Features

The UI now provides:

- ✅ **Better Instructions**: Clear steps to update wrangler.toml
- ✅ **Real-time Warnings**: Shows when UI and actual schedule don't match
- ✅ **Next Post Calculator**: Updates based on selected schedule
- ✅ **Helper Script**: Automated wrangler.toml updates

## Example: Changing to Every 5 Minutes

1. **In UI**: Select "⚡ Every 5 minutes" from dropdown
2. **Click**: "Update Schedule" button
3. **Follow Instructions**: UI shows steps to update wrangler.toml
4. **Run Command**: `npm run update-schedule "*/5 * * * *"`
5. **Deploy**: `npm run deploy`
6. **Verify**: Check deployment shows `schedule: */5 * * * *`

## Troubleshooting

**Q: UI shows new schedule but worker still runs on old schedule?**
A: You need to update wrangler.toml and redeploy.

**Q: How do I check current active schedule?**
A: Run `npm run deploy` - it shows current schedule in output.

**Q: Can I automate the entire process?**
A: Yes! Use: `npm run update-schedule "*/5 * * * *" && npm run deploy`

**Q: What if I set a very frequent schedule?**
A: Be careful with schedules under 5 minutes - they can consume resources quickly.

## Important Notes

- ⚠️ **Cloudflare Limits**: Very frequent schedules may hit rate limits
- 💡 **Best Practice**: Test with longer intervals first
- 🔄 **Always Deploy**: Schedule changes require redeployment
- 📊 **Monitor Usage**: Check Cloudflare dashboard for resource usage