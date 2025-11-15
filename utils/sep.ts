import { SEPBaseline } from '../types/database.types';

// Tolerance thresholds for SEP evaluation
export const REACTION_TOLERANCE_MS = 150;
export const PHRASE_TOLERANCE_SEC = 2;

/**
 * Evaluate a SEP attempt against the user's baseline
 * @param baseline - User's SEP baseline measurements
 * @param attempt - Current attempt measurements
 * @returns Evaluation result with pass/fail status and individual metric results
 */
export function evaluateSEPAttempt(
  baseline: SEPBaseline,
  attempt: {
    reactionAvgMs: number;
    phraseDurationSec: number;
  }
): {
  pass: boolean;
  reactionOk: boolean;
  phraseOk: boolean;
  reactionDiff: number;
  phraseDiff: number;
} {
  // Calculate differences from baseline
  const reactionDiff = attempt.reactionAvgMs - baseline.reactionAvgMs;
  const phraseDiff = attempt.phraseDurationSec - baseline.phraseDurationSec;

  // Check if within tolerance
  const reactionOk = reactionDiff <= REACTION_TOLERANCE_MS;
  const phraseOk = phraseDiff <= PHRASE_TOLERANCE_SEC;

  // Pass only if both metrics are within tolerance
  const pass = reactionOk && phraseOk;

  return {
    pass,
    reactionOk,
    phraseOk,
    reactionDiff,
    phraseDiff,
  };
}
