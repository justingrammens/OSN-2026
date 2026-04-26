/**
 * Runtime configuration for alert detection and escalation thresholds.
 *
 * Both fields must be positive integers. They are validated by
 * `validateConfig()` at startup — any invalid value causes a
 * `ConfigValidationError` before the system begins processing doses.
 *
 * Values are read once at startup and treated as immutable at runtime;
 * changing thresholds requires a restart.
 *
 * @satisfies REQ-011 REQ-012
 */
export interface AlertThresholdConfig {
  /** Minutes a dose may be overdue before ALERT_ACTIVE is raised. Default: 15. */
  readonly alertThresholdMinutes: number;

  /** Additional minutes after ALERT_ACTIVE before ALERT_ESCALATED is raised. Default: 10. */
  readonly escalationThresholdMinutes: number;
}
