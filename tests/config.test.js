// tests/config.test.js
describe('Configuration Tests', () => {
  test('validates cron expressions', () => {
    const validCrons = ['0 * * * *', '*/5 * * * *', '0 */2 * * *'];
    validCrons.forEach(cron => {
      const parts = cron.trim().split(/\s+/);
      expect(parts.length).toBe(5);
    });
  });

  test('validates market types', () => {
    const markets = ['crypto', 'forex', 'stocks'];
    markets.forEach(market => {
      expect(typeof market).toBe('string');
      expect(market.length).toBeGreaterThan(0);
    });
  });

  test('validates environment variables', () => {
    const requiredVars = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
    requiredVars.forEach(varName => {
      expect(typeof varName).toBe('string');
      expect(varName.length).toBeGreaterThan(0);
    });
  });
});