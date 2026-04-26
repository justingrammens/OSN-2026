import type { AlertThresholdConfig } from '../types/config.js';

/**
 * Thrown when `validateConfig` receives an invalid configuration value.
 *
 * Extends `Error` so it is catchable by the fail-safe error boundary, but
 * carries a typed `field` property so callers can distinguish startup
 * misconfiguration from runtime errors without string-parsing the message.
 */
export class ConfigValidationError extends Error {
  readonly field: 'alertThresholdMinutes' | 'escalationThresholdMinutes' | 'combined';

  constructor(
    field: ConfigValidationError['field'],
    message: string,
  ) {
    super(message);
    this.name  = 'ConfigValidationError';
    this.field = field;
  }
}

/**
 * Validate a raw (unknown) configuration object and return a typed
 * `AlertThresholdConfig` if valid, or throw `ConfigValidationError` if not.
 *
 * Called once at startup before any dose processing begins. An invalid
 * configuration causes the process to exit with a descriptive error rather
 * than silently using a wrong threshold at runtime.
 *
 * Rules enforced (both fields):
 *  - Present and of type `number`
 *  - Finite (not NaN, not Infinity)
 *  - Positive (> 0)
 *  - Integer (Math.floor(x) === x)
 *
 * Additional combined check:
 *  - alertThresholdMinutes + escalationThresholdMinutes <= Number.MAX_SAFE_INTEGER
 *
 * @satisfies REQ-011 REQ-012
 */
export function validateConfig(config: unknown): AlertThresholdConfig {
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    throw new ConfigValidationError(
      'alertThresholdMinutes',
      `Configuration must be a plain object, got: ${config === null ? 'null' : typeof config}`,
    );
  }

  const raw = config as Record<string, unknown>;

  const alertMins      = raw['alertThresholdMinutes'];
  const escalationMins = raw['escalationThresholdMinutes'];

  assertPositiveInteger(alertMins,      'alertThresholdMinutes');
  assertPositiveInteger(escalationMins, 'escalationThresholdMinutes');

  const a = alertMins as number;
  const e = escalationMins as number;

  if (a + e > Number.MAX_SAFE_INTEGER) {
    throw new ConfigValidationError(
      'combined',
      `Combined threshold (alertThresholdMinutes + escalationThresholdMinutes = ${a + e}) exceeds Number.MAX_SAFE_INTEGER`,
    );
  }

  return {
    alertThresholdMinutes:      a,
    escalationThresholdMinutes: e,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function assertPositiveInteger(
  value: unknown,
  field: 'alertThresholdMinutes' | 'escalationThresholdMinutes',
): asserts value is number {
  if (typeof value !== 'number') {
    throw new ConfigValidationError(
      field,
      `${field} must be a number, got: ${typeof value}`,
    );
  }
  if (!Number.isFinite(value)) {
    throw new ConfigValidationError(
      field,
      `${field} must be finite, got: ${value}`,
    );
  }
  if (value <= 0) {
    throw new ConfigValidationError(
      field,
      `${field} must be greater than 0, got: ${value}`,
    );
  }
  if (Math.floor(value) !== value) {
    throw new ConfigValidationError(
      field,
      `${field} must be an integer, got: ${value}`,
    );
  }
}
