import { ALL_COUNTRIES, COUNTRY_ALIASES, getCanonicalCountryName } from '../data/countries';
import {
  getDbCountries,
  getCountryPreExistingSpecs,
  GLOBAL_ALL_UNIVERSES,
  GLOBAL_ALL_QUOTAS
} from '../data/attachedSpecsData';

export interface ParsedChatSpecs {
  isAddCommand: boolean;
  isFeasibilityQuery: boolean;
  country: string;
  targetSize: number;
  universe: string;
  irRaw: string;
  loi: number;
  quotas: string;
  targetedCpi?: number;
  maxInternalPercent?: number;
  maxExternalCpi?: number;
  missingFields: string[];
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const LOCAL_COUNTRY_ALIASES: Record<string, string> = {
  'germania': 'Germany',
  'franta': 'France',
  'franța': 'France',
  'spania': 'Spain',
  'italia': 'Italy',
  'romania': 'Romania',
  'românia': 'Romania',
  'marea britanie': 'United Kingdom',
  'statele unite': 'United States',
  'olanda': 'Netherlands',
  'tarile de jos': 'Netherlands',
  'țările de jos': 'Netherlands',
  'elvetia': 'Switzerland',
  'elveția': 'Switzerland',
  'japonia': 'Japan',
  'ungaria': 'Hungary',
  'polonia': 'Poland',
  'belgia': 'Belgium',
  'suedia': 'Sweden',
  'norvegia': 'Norway',
  'danemarca': 'Denmark',
  'turcia': 'Turkey',
  'grecia': 'Greece',
  'portugalia': 'Portugal',
  'austria': 'Austria'
};

// Two-letter codes that collide with common English/Romanian words (e.g. "de", "it", "us", "ro", "ca", "es", "fr")
// Only match these when written in UPPERCASE in the user's message.
const STRICT_UPPERCASE_COUNTRY_CODES: Record<string, string> = {
  'DE': 'Germany',
  'FR': 'France',
  'ES': 'Spain',
  'IT': 'Italy',
  'RO': 'Romania',
  'NL': 'Netherlands',
  'CH': 'Switzerland',
  'CA': 'Canada',
  'AU': 'Australia',
  'JP': 'Japan',
  'US': 'United States',
  'GB': 'United Kingdom',
  'UK': 'United Kingdom'
};

export function detectCountryFromText(text: string, insertedDb?: any[]): string {
  const lower = text.toLowerCase();

  // Combine countries from active DB and ALL_COUNTRIES, sorted longest-first
  const candidateCountries = Array.from(
    new Set([...getDbCountries(insertedDb), ...ALL_COUNTRIES])
  ).sort((a, b) => b.length - a.length);

  for (const country of candidateCountries) {
    const pattern = new RegExp(`(?<![a-z0-9])${escapeRegExp(country.toLowerCase())}(?![a-z0-9])`, 'i');
    if (pattern.test(lower)) {
      return getCanonicalCountryName(country) || country;
    }
  }

  // Check multi-char aliases (>= 3 chars) case-insensitively
  const multiCharAliases: [string, string][] = [
    ...Object.entries(COUNTRY_ALIASES),
    ...Object.entries(LOCAL_COUNTRY_ALIASES)
  ]
    .filter(([alias]) => alias.length >= 3 || alias === 'uk')
    .sort((a, b) => b[0].length - a[0].length);

  for (const [alias, canonical] of multiCharAliases) {
    const pattern = new RegExp(`(?<![a-z0-9])${escapeRegExp(alias.toLowerCase())}(?![a-z0-9])`, 'i');
    if (pattern.test(lower)) {
      return getCanonicalCountryName(canonical) || canonical;
    }
  }

  // Check strict uppercase 2-letter country codes against original text (prevents "de", "it", "us", etc. false hits)
  for (const [code, canonical] of Object.entries(STRICT_UPPERCASE_COUNTRY_CODES)) {
    const pattern = new RegExp(`(?<![A-Za-z0-9])${code}(?![A-Za-z0-9])`);
    if (pattern.test(text)) {
      return canonical;
    }
  }

  return '';
}

export function detectUniverseFromText(text: string, detectedCountry: string, insertedDb?: any[]): string {
  // Strip command scaffolding (e.g. "add a new line", "insert new row", "check feasibility for")
  // so short DB universes like "new" never false-match conversational phrasing.
  const cleanedLower = text
    .toLowerCase()
    .replace(/\b(?:add|insert|create|check|calculate|adauga|adaugă|verifica|verifică)\s+(?:a\s+)?(?:new\s+)?(?:line|row|audience|scenario|spec|specs|linie|scenariu|audienta|audiență|feasibility|fezabilitate)\b/g, ' ')
    .replace(/\ba\s+new\s+(?:line|row|audience|scenario|linie|scenariu|audienta|audiență|spec|specs)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Build candidate universes dynamically from active DB (for country first, then whole DB)
  const dbUniversesSet = new Set<string>();
  if (detectedCountry) {
    const countrySpecs = getCountryPreExistingSpecs(detectedCountry, insertedDb);
    countrySpecs.universes.forEach(u => dbUniversesSet.add(u));
  }
  if (insertedDb && Array.isArray(insertedDb) && insertedDb.length > 0) {
    for (const row of insertedDb) {
      const u = String(row.irUniverse || row['IR universe'] || row['ir universe'] || row.target || row.Universe || '').trim();
      if (u) dbUniversesSet.add(u);
    }
  } else {
    GLOBAL_ALL_UNIVERSES.forEach(u => dbUniversesSet.add(u));
  }

  const candidates = Array.from(dbUniversesSet).sort((a, b) => b.length - a.length);

  for (const uni of candidates) {
    const uniLower = uni.toLowerCase().trim();
    if (!uniLower) continue;
    const prefix = /^[a-z0-9]/.test(uniLower) ? '(?<![a-z0-9])' : '';
    const suffix = /[a-z0-9]$/.test(uniLower) ? '(?![a-z0-9])' : '';
    const pattern = new RegExp(`${prefix}${escapeRegExp(uniLower)}${suffix}`, 'i');
    if (pattern.test(cleanedLower)) {
      return uni;
    }
  }

  // Shorthand matching ONLY against real universes available in the active DB for that country
  if (detectedCountry) {
    const countryUniverses = getCountryPreExistingSpecs(detectedCountry, insertedDb).universes;
    if (cleanedLower.includes('general population') || /\bgen\s*pop\b/i.test(cleanedLower)) {
      const exactGenPop = countryUniverses.find(u => u.toLowerCase() === 'gen pop');
      if (exactGenPop) return exactGenPop;
      const genPop1865 = countryUniverses.find(u => u.toLowerCase().includes('gen pop') && u.includes('18-65'));
      if (genPop1865) return genPop1865;
      const anyGenPop = countryUniverses.find(u => u.toLowerCase().includes('gen pop'));
      if (anyGenPop) return anyGenPop;
    }
  }

  return '';
}

export function detectQuotasFromText(text: string, detectedCountry: string, insertedDb?: any[]): string {
  const lower = text.toLowerCase();

  if (
    lower.includes('no quota') ||
    lower.includes('no quotas') ||
    lower.includes('without quotas') ||
    lower.includes('fara cote') ||
    lower.includes('fără cote')
  ) {
    return 'No quotas';
  }

  const dbQuotasSet = new Set<string>();
  if (detectedCountry) {
    getCountryPreExistingSpecs(detectedCountry, insertedDb).quotas.forEach(q => dbQuotasSet.add(q));
  }
  if (insertedDb && Array.isArray(insertedDb) && insertedDb.length > 0) {
    for (const row of insertedDb) {
      const q = String(row.quotas || row.Quotas || row.quota || '').trim();
      if (q) dbQuotasSet.add(q);
    }
  } else {
    GLOBAL_ALL_QUOTAS.forEach(q => dbQuotasSet.add(q));
  }

  const candidates = Array.from(dbQuotasSet).sort((a, b) => b.length - a.length);
  for (const q of candidates) {
    if (q.toLowerCase() === 'no quotas') continue;
    const pattern = new RegExp(`(?<![a-z0-9])${escapeRegExp(q.toLowerCase())}(?![a-z0-9])`, 'i');
    if (pattern.test(lower)) {
      return q;
    }
  }

  return '';
}

/**
 * Deterministic NL parser with ZERO fabricated defaults / assumptions.
 * Any unspecified field remains empty ("" or 0) and is reported in missingFields.
 */
export function parseNaturalLanguageSpecs(text: string, insertedDb?: any[]): ParsedChatSpecs {
  const lower = text.toLowerCase();

  const isRuleOrAuditQuery =
    /\b(rule|regula|cheapest|cel mai ieftin|optimize|deficit|shortage|unsatisfied|database|lookup|delete|remove line|remove row|cheapest source|cheapest vendor|lowest cpi|best rate)\b/i.test(lower);

  const isAddCommand =
    !isRuleOrAuditQuery &&
    (
      /\b(add|insert|adauga|adaugă)\b.*\b(line|row|linie|scenariu|scenario|audience|audienta|audiență)\b/i.test(lower) ||
      /^\s*(add|insert|adauga|adaugă)\b/i.test(lower)
    );

  const detectedCountry = detectCountryFromText(text, insertedDb);

  // Max internal percent constraint: e.g. "max 50% internal", "internal max 50%"
  let detectedMaxInternal: number | undefined = undefined;
  const internalMatch = text.match(/(?:max(?:imum)?\s*(\d+)%\s*internal)|(?:internal\s*(?:max|capped\s*at)?\s*(\d+)%)/i);
  if (internalMatch) {
    detectedMaxInternal = parseInt(internalMatch[1] || internalMatch[2], 10);
  }

  // Max external CPI constraint: e.g. "max external CPI of 3 euros", "max cpi 3"
  let detectedMaxCpi: number | undefined = undefined;
  const cpiMatch = text.match(/(?:max(?:imum)?\s*(?:external\s*)?cpi\s*(?:of|is|:|=)?\s*\$?€?(\d+(?:\.\d+)?))|(?:cpi\s*(?:of\s*max|max|capped\s*at|under|up\s*to)\s*\$?€?(\d+(?:\.\d+)?))/i);
  if (cpiMatch) {
    detectedMaxCpi = parseFloat(cpiMatch[1] || cpiMatch[2]);
  }

  // Targeted CPI: e.g. "targeted cpi 5", "target cpi $4.5"
  let detectedTargetedCpi: number | undefined = undefined;
  const targetedCpiMatch = text.match(/(?:target(?:ed)?\s*cpi\s*(?:of|is|:|=)?\s*\$?€?(\d+(?:\.\d+)?))/i);
  if (targetedCpiMatch) {
    detectedTargetedCpi = parseFloat(targetedCpiMatch[1]);
  }

  // Target size detection: explicit only (0 when omitted)
  let detectedTarget = 0;
  const targetMatch = text.match(/(?:target\s*(?:size)?\s*(?:of|is|:|=)?\s*(\d+))|(?:(\d+)\s*(?:n\b|target|completes|complete|interviews|sample|respondenti|respondenți))|(?:\bn\s*[=:]\s*(\d+))/i);
  if (targetMatch) {
    detectedTarget = parseInt(targetMatch[1] || targetMatch[2] || targetMatch[3], 10) || 0;
  }

  // LOI detection: explicit only (0 when omitted)
  let detectedLoi = 0;
  const loiMatch = text.match(/(?:loi\s*(?:of|is|:|=)?\s*(\d+))|(?:(\d+)\s*(?:min|minute|minutes|mins\b|m\b))/i);
  if (loiMatch) {
    detectedLoi = parseInt(loiMatch[1] || loiMatch[2], 10) || 0;
  }

  // IR% detection: explicit only ("" when omitted), ignoring "max X% internal"
  let detectedIrRaw = '';
  const textWithoutInternalPct = text
    .replace(/(?:max(?:imum)?\s*\d+%\s*internal)|(?:internal\s*(?:max|capped\s*at)?\s*\d+%)/gi, ' ');
  const irMatch = textWithoutInternalPct.match(/(?:ir%?\s*(?:of|is|:|=)?\s*(\d+(?:\.\d+)?)\s*%?)|(?:(\d+(?:\.\d+)?)\s*%\s*(?:ir|incidence|incidență|incidenta)?)/i);
  if (irMatch) {
    const val = irMatch[1] || irMatch[2];
    if (val) detectedIrRaw = `${val}%`;
  }

  const detectedUniverse = detectUniverseFromText(text, detectedCountry, insertedDb);
  const detectedQuotas = detectQuotasFromText(text, detectedCountry, insertedDb);

  const hasExplicitFeasibilityKeyword =
    /\b(calculate|feasibility|fezabilitate|quote|completes|what can be done)\b/i.test(lower);
  const hasAnySpec = Boolean(
    detectedCountry ||
    detectedTarget > 0 ||
    detectedLoi > 0 ||
    detectedIrRaw ||
    detectedUniverse ||
    detectedMaxInternal !== undefined ||
    detectedMaxCpi !== undefined
  );

  const isFeasibilityQuery = Boolean(
    !isRuleOrAuditQuery &&
    !isAddCommand &&
    (
      (detectedCountry && hasAnySpec) ||
      (hasExplicitFeasibilityKeyword && hasAnySpec)
    )
  );

  const missingFields: string[] = [];
  if (!detectedCountry) missingFields.push('Country');
  if (detectedTarget <= 0) missingFields.push('Target Size');
  if (!detectedUniverse) missingFields.push('IR Universe');
  if (!detectedIrRaw) missingFields.push('IR%');
  if (detectedLoi <= 0) missingFields.push('LOI');

  return {
    isAddCommand,
    isFeasibilityQuery,
    country: detectedCountry,
    targetSize: detectedTarget,
    universe: detectedUniverse,
    irRaw: detectedIrRaw,
    loi: detectedLoi,
    quotas: detectedQuotas,
    targetedCpi: detectedTargetedCpi,
    maxInternalPercent: detectedMaxInternal,
    maxExternalCpi: detectedMaxCpi,
    missingFields
  };
}
