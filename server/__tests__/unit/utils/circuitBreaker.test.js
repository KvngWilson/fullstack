const CircuitBreaker = require('../../../infrastructure/resilience/CircuitBreaker');

describe('CircuitBreaker', () => {
  let breaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 2,
      successThreshold: 1,
      timeout: 100,
      name: 'TestBreaker',
    });
  });

  test('executes successful function in CLOSED state', async () => {
    const fn = jest.fn().mockResolvedValue('ok');

    const result = await breaker.execute(fn);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(breaker.getState().state).toBe('CLOSED');
  });

  test('opens circuit after failure threshold', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('boom'));

    await expect(breaker.execute(fn)).rejects.toThrow('boom');
    await expect(breaker.execute(fn)).rejects.toThrow('boom');

    expect(breaker.getState().state).toBe('OPEN');
  });

  test('uses fallback while OPEN', async () => {
    const failingFn = jest.fn().mockRejectedValue(new Error('boom'));
    await expect(breaker.execute(failingFn)).rejects.toThrow();
    await expect(breaker.execute(failingFn)).rejects.toThrow();

    const primary = jest.fn();
    const fallback = jest.fn().mockResolvedValue('fallback-result');

    const result = await breaker.execute(primary, fallback);

    expect(result).toBe('fallback-result');
    expect(primary).not.toHaveBeenCalled();
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  test('reset returns breaker to CLOSED', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('boom'));
    await expect(breaker.execute(fn)).rejects.toThrow();
    await expect(breaker.execute(fn)).rejects.toThrow();

    expect(breaker.getState().state).toBe('OPEN');

    breaker.reset();

    expect(breaker.getState().state).toBe('CLOSED');
    expect(breaker.getState().failureCount).toBe(0);
  });
});
