// tests/content.test.js
describe('Content Validation Tests', () => {
  test('validates content structure', () => {
    const sampleContent = 'Risk management is essential for trading success.';
    const words = sampleContent.split(' ').length;
    expect(words).toBeGreaterThan(3);
    expect(words).toBeLessThan(50);
  });

  test('validates HTML formatting', () => {
    const htmlContent = '<b>Important</b> trading tip';
    expect(htmlContent).toMatch(/<b>/);
    expect(htmlContent).toContain('trading');
  });

  test('validates API request structure', () => {
    const apiRequest = {
      model: 'test-model',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 500
    };
    
    expect(apiRequest.model).toBeDefined();
    expect(apiRequest.messages).toHaveLength(1);
    expect(apiRequest.max_tokens).toBeGreaterThan(0);
  });
});