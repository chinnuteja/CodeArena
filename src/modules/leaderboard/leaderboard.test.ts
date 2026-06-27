import { describe, it, expect } from 'vitest';
import { encodeScore } from './leaderboard.service.js';
import { ScoringMode } from '../../config/constants.js';

describe('Composite Score Encoder', () => {
  it('should rank higher ICPC solved count above lower solved count', () => {
    // 3 solved, 50 penalty mins
    const a = encodeScore(ScoringMode.ICPC, 3, 50);
    // 2 solved, 0 penalty mins
    const b = encodeScore(ScoringMode.ICPC, 2, 0);
    
    // a should be strictly greater than b
    expect(a).toBeGreaterThan(b);
  });

  it('should rank lower penalty higher when ICPC solved count is tied', () => {
    // 3 solved, 10 penalty mins
    const a = encodeScore(ScoringMode.ICPC, 3, 10);
    // 3 solved, 50 penalty mins
    const b = encodeScore(ScoringMode.ICPC, 3, 50);
    
    // a should be greater than b (since penalty is subtracted)
    expect(a).toBeGreaterThan(b);
  });

  it('should rank higher IOI points above lower IOI points', () => {
    // 150 points, 1000 seconds
    const a = encodeScore(ScoringMode.IOI, 150, 1000);
    // 100 points, 0 seconds
    const b = encodeScore(ScoringMode.IOI, 100, 0);

    expect(a).toBeGreaterThan(b);
  });

  it('should rank earlier IOI time higher when points are tied', () => {
    // 150 points, 1000 seconds
    const a = encodeScore(ScoringMode.IOI, 150, 1000);
    // 150 points, 2000 seconds
    const b = encodeScore(ScoringMode.IOI, 150, 2000);

    expect(a).toBeGreaterThan(b);
  });
});
