// tests/trading-tips.test.js
const worker = require('../src/index.js');

describe('Trading Tips Content', () => {
  describe('Fallback Tips', () => {
    test('contains risk management advice', () => {
      const tip = worker.fallbackText('crypto');
      expect(tip).toMatch(/risk|stop loss|capital/i);
    });

    test('includes actionable takeaway', () => {
      const tip = worker.fallbackText('forex');
      expect(tip).toMatch(/Takeaway:/);
    });

    test('adapts content based on market type', () => {
      const cryptoTip = worker.fallbackText('crypto');
      const forexTip = worker.fallbackText('forex');
      expect(cryptoTip).not.toBe(forexTip);
      expect(cryptoTip).toContain('crypto');
      expect(forexTip).toContain('forex');
    });

    test('tips have reasonable length', () => {
      const tip = worker.fallbackText('crypto');
      const words = tip.split(' ').length;
      expect(words).toBeGreaterThan(10);
      expect(words).toBeLessThan(100);
    });
  });

  describe('Image Generation', () => {
    test('generates unique URLs for different keywords', () => {
      const url1 = worker.getUnsplashImageUrl(['crypto', 'bitcoin']);
      const url2 = worker.getUnsplashImageUrl(['forex', 'trading']);
      expect(url1).not.toBe(url2);
    });

    test('includes all keywords in URL', () => {
      const keywords = ['trading', 'analysis', 'chart'];
      const url = worker.getUnsplashImageUrl(keywords);
      keywords.forEach(keyword => {
        expect(url).toContain(keyword);
      });
    });

    test('properly encodes URL parameters', () => {
      const url = worker.getUnsplashImageUrl(['forex trading']);
      expect(url).toContain(encodeURIComponent('forex trading'));
    });
  });

  describe('OpenRouter Integration', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    test('handles successful API response', async () => {
      global.fetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            choices: [{
              message: {
                content: 'Test trading tip'
              }
            }]
          })
        })
      );

      const result = await worker.generateTextWithOpenRouter(
        'Write a trading tip',
        'test-api-key'
      );
      expect(result).toBe('Test trading tip');
    });

    test('handles rate limiting', async () => {
      global.fetch
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 429,
            headers: new Map([['Retry-After', '1']]),
            text: () => Promise.resolve('Rate limited')
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              choices: [{
                message: {
                  content: 'Test trading tip'
                }
              }]
            })
          })
        );

      const result = await worker.generateTextWithOpenRouter(
        'Write a trading tip',
        'test-api-key'
      );
      expect(result).toBe('Test trading tip');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
