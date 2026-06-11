import {
  evaluateSEPAttempt,
  REACTION_TOLERANCE_MS,
  PHRASE_TOLERANCE_SEC,
} from '../sep';
import { SEPBaseline } from '../../types/database.types';

/**
 * SEP evaluation is the safety gate that decides whether a member is cleared to
 * drive. These tests pin the exact pass/fail behavior — a silent regression here
 * could clear an impaired driver or wrongly revoke a sober one.
 */

const baseline: SEPBaseline = {
  id: 'b1',
  userId: 'u1',
  reactionAvgMs: 300,
  phraseDurationSec: 2.0,
  selfieUrl: null as any,
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

describe('evaluateSEPAttempt', () => {
  it('passes when both metrics are comfortably within tolerance', () => {
    const r = evaluateSEPAttempt(baseline, { reactionAvgMs: 350, phraseDurationSec: 2.5 });
    expect(r.pass).toBe(true);
    expect(r.reactionOk).toBe(true);
    expect(r.phraseOk).toBe(true);
  });

  it('passes a faster reaction / shorter phrase (negative diffs are fine)', () => {
    const r = evaluateSEPAttempt(baseline, { reactionAvgMs: 200, phraseDurationSec: 1.0 });
    expect(r.pass).toBe(true);
    expect(r.reactionDiff).toBe(-100);
    expect(r.phraseDiff).toBeCloseTo(-1.0, 5);
  });

  it('treats the tolerance boundary as inclusive (exactly +tolerance still passes)', () => {
    const r = evaluateSEPAttempt(baseline, {
      reactionAvgMs: 300 + REACTION_TOLERANCE_MS, // exactly +150ms
      phraseDurationSec: 2.0 + PHRASE_TOLERANCE_SEC, // exactly +2.0s
    });
    expect(r.reactionOk).toBe(true);
    expect(r.phraseOk).toBe(true);
    expect(r.pass).toBe(true);
  });

  it('fails when reaction time is just past tolerance', () => {
    const r = evaluateSEPAttempt(baseline, { reactionAvgMs: 451, phraseDurationSec: 2.0 });
    expect(r.reactionOk).toBe(false);
    expect(r.pass).toBe(false);
  });

  it('fails when phrase duration is just past tolerance', () => {
    const r = evaluateSEPAttempt(baseline, { reactionAvgMs: 300, phraseDurationSec: 4.01 });
    expect(r.phraseOk).toBe(false);
    expect(r.pass).toBe(false);
  });

  it('fails overall if either single metric fails', () => {
    const reactionFails = evaluateSEPAttempt(baseline, { reactionAvgMs: 600, phraseDurationSec: 2.0 });
    const phraseFails = evaluateSEPAttempt(baseline, { reactionAvgMs: 300, phraseDurationSec: 9.0 });
    expect(reactionFails.pass).toBe(false);
    expect(phraseFails.pass).toBe(false);
  });

  it('fails safe on NaN input (never silently clears a driver)', () => {
    const r = evaluateSEPAttempt(baseline, { reactionAvgMs: NaN, phraseDurationSec: NaN });
    expect(r.pass).toBe(false);
  });

  it('reports the raw differences from baseline', () => {
    const r = evaluateSEPAttempt(baseline, { reactionAvgMs: 380, phraseDurationSec: 3.2 });
    expect(r.reactionDiff).toBe(80);
    expect(r.phraseDiff).toBeCloseTo(1.2, 5);
  });
});
