import { FeasibilityRow } from '../types';
import { ALL_COUNTRIES, isValidCountry, getCanonicalCountryName } from '../data/countries';

export { isValidCountry, ALL_COUNTRIES, getCanonicalCountryName };

/**
 * Checks if a quota string denotes "no quotas" / "none".
 */
export function isNoQuotas(qStr?: string): boolean {
  if (!qStr) return true;
  const s = String(qStr).toLowerCase().replace(/[^a-z0-9]/g, '');
  return !s || s === 'no' || s === 'noquotas' || s === 'none' || s === 'noquota' || s === 'na' || s === 'noquotaavailable';
}

/**
 * Normalizes an IR value to a decimal fraction (e.g., 20% -> 0.20, 0.20 -> 0.20, 17 -> 0.17).
 */
export function normalizeIr(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') {
    return val > 1 ? val / 100 : val;
  }
  const str = String(val).trim();
  if (!str) return 0;
  const num = parseFloat(str.replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return 0;
  return num > 1 ? num / 100 : num;
}

/**
 * Normalizes LOI to a number.
 */
export function normalizeLoi(val: any): number {
  if (val === undefined || val === null) return 0;
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 0 : num;
}

/**
 * Clean a specification string for strict matching (alphanumeric lowercase).
 */
export function cleanSpecString(s: any): string {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Checks if incidence universe or target specification matches 100%.
 */
export function matchUniverse(pitch: FeasibilityRow, dbRow: any): boolean {
  const uPitch = cleanSpecString(pitch.irUniverse);
  const tPitch = cleanSpecString(pitch.target);
  const uDb = cleanSpecString(dbRow.irUniverse);
  const tDb = cleanSpecString(dbRow.target);

  const pitchDescriptors = [uPitch, tPitch].filter(Boolean);
  const dbDescriptors = [uDb, tDb].filter(Boolean);

  if (pitchDescriptors.length === 0 && dbDescriptors.length === 0) return true;
  if (pitchDescriptors.length === 0 || dbDescriptors.length === 0) return false;

  // 100% match: at least one pitch descriptor equals a db descriptor
  return pitchDescriptors.some(pd => dbDescriptors.includes(pd));
}

/**
 * Checks if quotas match.
 * RULE: If pitch requests "no quotas", then ANY feasibility with or without quotas
 * in the database on that universe can be utilized (e.g. even if DB has AGR,
 * Age and gender, etc., choosing "no quotas" delivers the feasibility).
 */
export function matchQuotas(pitch: FeasibilityRow, dbRow: any): boolean {
  const pitchNoQ = isNoQuotas(pitch.quotas);
  const dbNoQ = isNoQuotas(dbRow.quotas);

  // If the user selected "no quotas", any feasibility in the database on that universe
  // (with or without quotas) qualifies!
  if (pitchNoQ) {
    return true;
  }

  // If pitch specified specific quotas, but DB row has no quotas:
  if (dbNoQ) return false;

  // Both have quotas specified: they must match 100%
  return cleanSpecString(pitch.quotas) === cleanSpecString(dbRow.quotas);
}

/**
 * Evaluates whether a database row can serve as feasibility for a pitch row.
 *
 * Rules:
 * 1. 100% match on Country (must also be a valid country from ALL_COUNTRIES, not gibberish).
 * 2. 100% match on Incidence Universe / Target.
 * 3. 100% match on Quotas.
 * 4. LOI:
 *    - Exact match, OR
 *    - Higher LOI with max 5 min difference (e.g., loiDb >= loiPitch && loiDb - loiPitch <= 5).
 *    (Lower LOI is not allowed).
 * 5. IR% (Incidence Rate):
 *    - Exact match, OR
 *    - Lower incidence with max 10% difference (e.g., irDb <= irPitch && irPitch - irDb <= 0.10).
 *    (Higher IR is not allowed).
 *
 * Example:
 * If pitch needs 200c at 20% IR, gen pop, 10 LOI,
 * and database has 17% IR, gen pop, 12 LOI,
 * this qualifies as a valid reference!
 */
export interface DbMatchResult {
  isMatch: boolean;
  score: number;
  hasLoiMarkup?: boolean;
  loiMarkupPct?: number;
  loiDiff?: number;
  matchedDbLoi?: number;
  irReductionFactor?: number;
  irReductionPct?: number;
  matchedDbIr?: number;
}

/**
 * Evaluates whether a database row can serve as feasibility for a pitch row.
 *
 * Rules:
 * 1. 100% match on Country (must also be a valid country from ALL_COUNTRIES).
 * 2. 100% match on Incidence Universe / Target.
 * 3. 100% match on Quotas (if pitch chooses "no quotas", any DB row qualifies).
 * 4. LOI Rules:
 *    - Lower LOI by up to 10 min vs DB (loiPitch < loiDb && loiDb - loiPitch <= 10):
 *      Can quote and reuse database with same prices (hasLoiMarkup = false).
 *    - Higher LOI by up to 5 min vs DB (loiPitch > loiDb && loiPitch - loiDb <= 5):
 *      Can reuse database and applies +10% extra mark-up on weighted CPI (hasLoiMarkup = true).
 *    - Exact match: standard matching.
 *    - Any other LOI difference: no match.
 * 5. IR% Rules:
 *    - Lower incidence by up to -10% vs DB (irPitch < irDb && irDb - irPitch <= 0.10):
 *      Feasibility generated is reduced by this percentage to reflect reality.
 *    - Higher incidence (irPitch >= irDb):
 *      Use closest feasibility without applying reduction factors.
 */
export function evaluateDbMatch(pitch: FeasibilityRow, dbRow: any): DbMatchResult {
  // 1. Country validation: if market name is gibberish or not in country list -> 0 output
  if (!isValidCountry(pitch.market)) {
    return { isMatch: false, score: -1 };
  }

  // Country 100% match (canonicalized, so UAE == United Arab Emirates, UK == United Kingdom, US == United States)
  const cPitch = cleanSpecString(getCanonicalCountryName(pitch.market));
  const cDb = cleanSpecString(getCanonicalCountryName(dbRow.market || dbRow.Country));
  if (cPitch !== cDb) {
    return { isMatch: false, score: -1 };
  }

  // 2. Incidence Universe / Target 100% match
  if (!matchUniverse(pitch, dbRow)) {
    return { isMatch: false, score: -1 };
  }

  // 3. Quotas 100% match (if user selected no quotas, all qualify)
  if (!matchQuotas(pitch, dbRow)) {
    return { isMatch: false, score: -1 };
  }

  // 4. LOI Check
  const loiPitch = normalizeLoi(pitch.loi);
  const loiDb = normalizeLoi(dbRow.loi !== undefined ? dbRow.loi : dbRow.LOI);

  let hasLoiMarkup = false;
  let loiMarkupPct = 0;
  let loiDiff = 0;

  if (loiPitch > 0 && loiDb > 0) {
    if (Math.abs(loiPitch - loiDb) < 0.001) {
      // Exact match
      hasLoiMarkup = false;
    } else if (loiPitch < loiDb) {
      // Lower LOI by up to 10 min vs database
      const diff = loiDb - loiPitch;
      if (diff > 10.0001) {
        return { isMatch: false, score: -1 };
      }
      loiDiff = diff;
      hasLoiMarkup = false;
    } else {
      // Higher LOI by up to 5 min vs database
      const diff = loiPitch - loiDb;
      if (diff > 5.0001) {
        return { isMatch: false, score: -1 };
      }
      loiDiff = diff;
      hasLoiMarkup = true;
      loiMarkupPct = 10;
    }
  }

  // 5. IR% Check
  const irPitch = normalizeIr(pitch.irPercent);
  const irDb = normalizeIr(
    dbRow.irPercent !== undefined 
      ? dbRow.irPercent 
      : (dbRow['ir%'] !== undefined ? dbRow['ir%'] : dbRow.irPercentDecimal)
  );

  let irReductionFactor = 1.0;
  let irReductionPct = 0;
  let irDiff = 0;

  if (irPitch > 0 && irDb > 0) {
    if (irPitch < irDb - 0.0001) {
      irDiff = irDb - irPitch;
      // Max difference 10% (0.10)
      if (irDiff > 0.10001) {
        return { isMatch: false, score: -1 };
      }
      // Feasibility is scaled down by the ratio between actual requested incidence and database incidence:
      // e.g., if incidence drops from 20% in DB to 13% requested (7% difference, within 10% threshold):
      // irPitch / irDb = 13% / 20% = 0.65 (65%).
      // The reduction is 100% - 65% = 35%.
      // Feasibility capacity is multiplied by 0.65 (65%) to reflect reality.
      irReductionFactor = Math.max(0.01, irPitch / irDb);
      irReductionPct = Math.round((1 - irReductionFactor) * 100);
    } else {
      // Higher or equal incidence: closest feasibility without applying reduction factors
      irDiff = irPitch - irDb;
      irReductionFactor = 1.0;
      irReductionPct = 0;
    }
  }

  // Calculate score: higher score for exact matches
  let score = 1000;

  // LOI proximity
  const absLoiDiff = Math.abs(loiDb - loiPitch);
  score += Math.max(0, (10 - absLoiDiff) * 20);

  // IR proximity
  const absIrDiff = Math.abs(irPitch - irDb);
  score += Math.max(0, (0.20 - absIrDiff) * 1000);

  return {
    isMatch: true,
    score,
    hasLoiMarkup,
    loiMarkupPct,
    loiDiff,
    matchedDbLoi: loiDb,
    irReductionFactor,
    irReductionPct,
    matchedDbIr: irDb
  };
}

/**
 * Finds all valid matching database rows for a pitch row, prioritizing exact matches.
 */
export function findBestDbMatches(
  pitch: FeasibilityRow,
  dbRows: FeasibilityRow[],
  excludedIds: Set<string> = new Set()
): FeasibilityRow[] {
  // If the country name is gibberish or not in country list -> 0 output
  if (!isValidCountry(pitch.market)) {
    return [];
  }

  const candidates = dbRows.filter(r => !excludedIds.has(r.id));
  const scoredMatches: { dbRow: FeasibilityRow; score: number }[] = [];

  for (const dbRow of candidates) {
    const evaluation = evaluateDbMatch(pitch, dbRow);
    if (evaluation.isMatch) {
      scoredMatches.push({
        dbRow: {
          ...dbRow,
          _matchMetadata: {
            hasLoiMarkup: evaluation.hasLoiMarkup,
            loiMarkupPct: evaluation.loiMarkupPct,
            loiDiff: evaluation.loiDiff,
            matchedDbLoi: evaluation.matchedDbLoi,
            irReductionFactor: evaluation.irReductionFactor,
            irReductionPct: evaluation.irReductionPct,
            matchedDbIr: evaluation.matchedDbIr
          }
        },
        score: evaluation.score
      });
    }
  }

  if (scoredMatches.length === 0) {
    return [];
  }

  // Sort descending by score (best match first)
  scoredMatches.sort((a, b) => b.score - a.score);

  const topScore = scoredMatches[0].score;
  // Return top matches (or within 5 score points of top score to capture identical specs across vendors)
  return scoredMatches
    .filter(m => m.score >= topScore - 5)
    .map(m => m.dbRow);
}
