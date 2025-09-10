// tests/index.test.js
const worker = require('../src/index.js');

describe('Trading Education Bot', () => {
  const mockEnv = {
    TELEGRAM_BOT_TOKEN: 'test-token',
    TELEGRAM_CHAT_ID: 'test-chat-id',
    OPENROUTER_API_KEY: 'test-api-key'
  };

  const mockSuccessResponse = {
    ok: true,
    json: () => Promise.resolve({
      choices: [{
        message: {
          content: 'Test trading tip'
        }
      }]
    }),
    text: () => Promise.resolve('{"ok":true}')
  };

  const mockErrorResponse = {
    ok: false,
    status: 429,
    text: () => Promise.resolve('Rate limited'),
    headers: new Map([['Retry-After', '30']])
  };

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('fallbackText returns a non-empty string', () => {
    const text = worker.fallbackText('crypto');
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain('crypto');
  });

  test('getUnsplashImageUrl returns valid URL', () => {
    const url = worker.getUnsplashImageUrl(['crypto', 'trading']);
    expect(url).toMatch(/^https:\/\/source\.unsplash\.com\/1600x900\/\?/);
    expect(url).toContain('crypto');
    expect(url).toContain('trading');
  });

  test('buildAndSend handles missing OpenRouter API key gracefully', async () => {
    const envWithoutOpenRouter = {
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: 'test-chat-id'
    };

    global.fetch.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve('{"ok":true}')
      })
    );

    await expect(worker.buildAndSend(envWithoutOpenRouter)).resolves.not.toThrow();
  });
});
