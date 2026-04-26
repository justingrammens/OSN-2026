import { describe, it, expect } from 'vitest';
import {
  validateConfig,
  ConfigValidationError,
} from '../../../src/engine/config-validator.js';

// ---------------------------------------------------------------------------
// REQ-011: alertThresholdMinutes validated at config load
// ---------------------------------------------------------------------------

describe('REQ-011: alertThresholdMinutes validated at config load', () => {
  it('accepts default value of 15', () => {
    const result = validateConfig({ alertThresholdMinutes: 15, escalationThresholdMinutes: 10 });

    expect(result.alertThresholdMinutes).toBe(15);
  });

  it('accepts minimum valid value of 1', () => {
    const result = validateConfig({ alertThresholdMinutes: 1, escalationThresholdMinutes: 1 });

    expect(result.alertThresholdMinutes).toBe(1);
  });

  it('throws ConfigValidationError when alertThresholdMinutes is 0 (boundary)', () => {
    expect(() =>
      validateConfig({ alertThresholdMinutes: 0, escalationThresholdMinutes: 10 }),
    ).toThrowError(ConfigValidationError);
  });

  it('sets field to "alertThresholdMinutes" when that field is 0', () => {
    try {
      validateConfig({ alertThresholdMinutes: 0, escalationThresholdMinutes: 10 });
      expect.fail('expected ConfigValidationError');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigValidationError);
      expect((err as ConfigValidationError).field).toBe('alertThresholdMinutes');
    }
  });

  it('throws when alertThresholdMinutes is negative (-1)', () => {
    expect(() =>
      validateConfig({ alertThresholdMinutes: -1, escalationThresholdMinutes: 10 }),
    ).toThrowError(ConfigValidationError);
  });

  it('throws when alertThresholdMinutes is a non-integer (1.5)', () => {
    expect(() =>
      validateConfig({ alertThresholdMinutes: 1.5, escalationThresholdMinutes: 10 }),
    ).toThrowError(ConfigValidationError);
  });

  it('throws when alertThresholdMinutes is NaN', () => {
    expect(() =>
      validateConfig({ alertThresholdMinutes: NaN, escalationThresholdMinutes: 10 }),
    ).toThrowError(ConfigValidationError);
  });

  it('throws when alertThresholdMinutes is Infinity', () => {
    expect(() =>
      validateConfig({ alertThresholdMinutes: Infinity, escalationThresholdMinutes: 10 }),
    ).toThrowError(ConfigValidationError);
  });

  it('throws when alertThresholdMinutes is -Infinity', () => {
    expect(() =>
      validateConfig({ alertThresholdMinutes: -Infinity, escalationThresholdMinutes: 10 }),
    ).toThrowError(ConfigValidationError);
  });

  it('throws when alertThresholdMinutes is a string', () => {
    expect(() =>
      validateConfig({ alertThresholdMinutes: '15', escalationThresholdMinutes: 10 }),
    ).toThrowError(ConfigValidationError);
  });

  it('throws when alertThresholdMinutes is absent (undefined)', () => {
    expect(() =>
      validateConfig({ escalationThresholdMinutes: 10 }),
    ).toThrowError(ConfigValidationError);
  });

  it('throws when alertThresholdMinutes is null', () => {
    expect(() =>
      validateConfig({ alertThresholdMinutes: null, escalationThresholdMinutes: 10 }),
    ).toThrowError(ConfigValidationError);
  });

  it('error message contains the field name', () => {
    try {
      validateConfig({ alertThresholdMinutes: 0, escalationThresholdMinutes: 10 });
      expect.fail('expected ConfigValidationError');
    } catch (err) {
      expect((err as ConfigValidationError).message).toContain('alertThresholdMinutes');
    }
  });

  it('error name is "ConfigValidationError" (not generic "Error")', () => {
    try {
      validateConfig({ alertThresholdMinutes: -5, escalationThresholdMinutes: 10 });
      expect.fail('expected ConfigValidationError');
    } catch (err) {
      expect((err as Error).name).toBe('ConfigValidationError');
    }
  });
});

// ---------------------------------------------------------------------------
// REQ-012: escalationThresholdMinutes validated at config load
// ---------------------------------------------------------------------------

describe('REQ-012: escalationThresholdMinutes validated at config load', () => {
  it('accepts default value of 10', () => {
    const result = validateConfig({ alertThresholdMinutes: 15, escalationThresholdMinutes: 10 });

    expect(result.escalationThresholdMinutes).toBe(10);
  });

  it('accepts minimum valid value of 1', () => {
    const result = validateConfig({ alertThresholdMinutes: 1, escalationThresholdMinutes: 1 });

    expect(result.escalationThresholdMinutes).toBe(1);
  });

  it('throws ConfigValidationError when escalationThresholdMinutes is 0 (boundary)', () => {
    expect(() =>
      validateConfig({ alertThresholdMinutes: 15, escalationThresholdMinutes: 0 }),
    ).toThrowError(ConfigValidationError);
  });

  it('sets field to "escalationThresholdMinutes" when that field is 0', () => {
    try {
      validateConfig({ alertThresholdMinutes: 15, escalationThresholdMinutes: 0 });
      expect.fail('expected ConfigValidationError');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigValidationError);
      expect((err as ConfigValidationError).field).toBe('escalationThresholdMinutes');
    }
  });

  it('throws when escalationThresholdMinutes is negative', () => {
    expect(() =>
      validateConfig({ alertThresholdMinutes: 15, escalationThresholdMinutes: -10 }),
    ).toThrowError(ConfigValidationError);
  });

  it('throws when escalationThresholdMinutes is a non-integer (0.5)', () => {
    expect(() =>
      validateConfig({ alertThresholdMinutes: 15, escalationThresholdMinutes: 0.5 }),
    ).toThrowError(ConfigValidationError);
  });

  it('throws when escalationThresholdMinutes is NaN', () => {
    expect(() =>
      validateConfig({ alertThresholdMinutes: 15, escalationThresholdMinutes: NaN }),
    ).toThrowError(ConfigValidationError);
  });

  it('throws when escalationThresholdMinutes is Infinity', () => {
    expect(() =>
      validateConfig({ alertThresholdMinutes: 15, escalationThresholdMinutes: Infinity }),
    ).toThrowError(ConfigValidationError);
  });

  it('throws when escalationThresholdMinutes is absent (undefined)', () => {
    expect(() =>
      validateConfig({ alertThresholdMinutes: 15 }),
    ).toThrowError(ConfigValidationError);
  });

  it('throws when escalationThresholdMinutes is a string', () => {
    expect(() =>
      validateConfig({ alertThresholdMinutes: 15, escalationThresholdMinutes: '10' }),
    ).toThrowError(ConfigValidationError);
  });

  it('sets field to "combined" when sum exceeds Number.MAX_SAFE_INTEGER', () => {
    try {
      validateConfig({
        alertThresholdMinutes:      Number.MAX_SAFE_INTEGER,
        escalationThresholdMinutes: 1,
      });
      expect.fail('expected ConfigValidationError');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigValidationError);
      expect((err as ConfigValidationError).field).toBe('combined');
    }
  });

  it('throws when combined sum exceeds MAX_SAFE_INTEGER', () => {
    expect(() =>
      validateConfig({
        alertThresholdMinutes:      Number.MAX_SAFE_INTEGER,
        escalationThresholdMinutes: 1,
      }),
    ).toThrowError(ConfigValidationError);
  });

  it('accepts two values whose sum equals floor(MAX_SAFE_INTEGER / 2) * 2', () => {
    const half = Math.floor(Number.MAX_SAFE_INTEGER / 2);

    expect(() =>
      validateConfig({ alertThresholdMinutes: half, escalationThresholdMinutes: half }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Return value and non-object input shapes
// ---------------------------------------------------------------------------

describe('validateConfig: return value and structural validation', () => {
  it('returns both fields with correct values on valid input', () => {
    const result = validateConfig({ alertThresholdMinutes: 20, escalationThresholdMinutes: 5 });

    expect(result).toEqual({ alertThresholdMinutes: 20, escalationThresholdMinutes: 5 });
  });

  it('ignores extra unknown fields without throwing', () => {
    expect(() =>
      validateConfig({ alertThresholdMinutes: 15, escalationThresholdMinutes: 10, extra: true }),
    ).not.toThrow();
  });

  it('throws when config is null', () => {
    expect(() => validateConfig(null)).toThrowError(ConfigValidationError);
  });

  it('throws when config is an array', () => {
    expect(() => validateConfig([15, 10])).toThrowError(ConfigValidationError);
  });

  it('throws when config is a string', () => {
    expect(() => validateConfig('15')).toThrowError(ConfigValidationError);
  });

  it('throws when config is a number', () => {
    expect(() => validateConfig(42)).toThrowError(ConfigValidationError);
  });

  it('throws when config is undefined', () => {
    expect(() => validateConfig(undefined)).toThrowError(ConfigValidationError);
  });
});
