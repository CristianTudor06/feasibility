import rawAttachedSpecs from './attachedSpecs.json';
import { getCanonicalCountryName } from './countries';

// Reference record interface matching the updated variables dataset
export interface ReferenceSpecRecord {
  market: string;
  loi: number;
  irRaw: string;
  universe: string;
  quotas: string;
}

export interface CountrySpecsOptions {
  countryName: string;
  lois: number[];
  irs: string[];
  universes: string[];
  quotas: string[];
}

export interface SpecsOptionsForPitch {
  preExistingUniverses: string[];
  preExistingLois: number[];
  preExistingIrs: string[];
  preExistingQuotas: string[];
  universeDropdownOptions: string[];
  loiDropdownOptions: number[];
  irDropdownOptions: string[];
  quotaDropdownOptions: string[];
}

// Cast imported JSON data to typed records
export const ATTACHED_REFERENCE_SPECS: ReferenceSpecRecord[] = rawAttachedSpecs as ReferenceSpecRecord[];

// Global aggregates
const globalLoisSet = new Set<number>();
const globalIrsSet = new Set<string>();
const globalUniversesSet = new Set<string>();
const globalQuotasSet = new Set<string>();

export const COUNTRY_SPECS_MAP: Record<string, CountrySpecsOptions> = {};

// Build COUNTRY_SPECS_MAP and global sets from the updated attached specs
for (const spec of ATTACHED_REFERENCE_SPECS) {
  const canonicalMarket = getCanonicalCountryName(spec.market);
  const cleanKey = canonicalMarket.toLowerCase();

  if (spec.loi && spec.loi > 0) globalLoisSet.add(spec.loi);
  if (spec.irRaw) globalIrsSet.add(spec.irRaw.trim());
  if (spec.universe) globalUniversesSet.add(spec.universe.trim());
  if (spec.quotas) globalQuotasSet.add(spec.quotas.trim());

  if (!COUNTRY_SPECS_MAP[cleanKey]) {
    COUNTRY_SPECS_MAP[cleanKey] = {
      countryName: canonicalMarket,
      lois: [],
      irs: [],
      universes: [],
      quotas: []
    };
  }

  const cty = COUNTRY_SPECS_MAP[cleanKey];
  if (spec.loi && spec.loi > 0 && !cty.lois.includes(spec.loi)) {
    cty.lois.push(spec.loi);
  }
  if (spec.irRaw && !cty.irs.includes(spec.irRaw.trim())) {
    cty.irs.push(spec.irRaw.trim());
  }
  if (spec.universe && !cty.universes.includes(spec.universe.trim())) {
    cty.universes.push(spec.universe.trim());
  }
  if (spec.quotas && !cty.quotas.includes(spec.quotas.trim())) {
    cty.quotas.push(spec.quotas.trim());
  }
}

// Sort numeric LOIs
for (const key of Object.keys(COUNTRY_SPECS_MAP)) {
  COUNTRY_SPECS_MAP[key].lois.sort((a, b) => a - b);
}

// Full list 1 to 100 minutes for LOI
export const GLOBAL_ALL_LOIS: number[] = Array.from({ length: 100 }, (_, i) => i + 1);

// Full list 1% to 100% for IR%
export const GLOBAL_ALL_IRS: string[] = Array.from({ length: 100 }, (_, i) => `${i + 1}%`);

export const GLOBAL_ALL_UNIVERSES: string[] = Array.from(globalUniversesSet).sort();
export const GLOBAL_ALL_QUOTAS: string[] = Array.from(globalQuotasSet).sort();

// List of all canonical country names that have data in the database
export const ALL_DB_COUNTRIES: string[] = Object.values(COUNTRY_SPECS_MAP)
  .map(c => c.countryName)
  .filter(Boolean)
  .sort();

/**
 * Returns available countries from the active database.
 * If a custom/new database is loaded, it takes countries exclusively from that database.
 */
export function getDbCountries(insertedDb?: any[]): string[] {
  if (insertedDb && Array.isArray(insertedDb) && insertedDb.length > 0) {
    const set = new Set<string>();
    for (const r of insertedDb) {
      const c = r.market || r.Market || r.Country || r.country;
      if (c) {
        const canonical = getCanonicalCountryName(c);
        if (canonical) set.add(canonical);
      }
    }
    return Array.from(set).sort();
  }
  return ALL_DB_COUNTRIES;
}

/**
 * Returns pre-existing specs for a country across the entire database.
 * Takes variables from Market, LOI, IR universe, IR%, and Quotas columns.
 * If a new database is inserted, variables are taken exclusively from the new database.
 */
export function getCountryPreExistingSpecs(country?: string, insertedDb?: any[]): CountrySpecsOptions {
  const canonical = getCanonicalCountryName(country);
  const clean = canonical.toLowerCase();

  const lois = new Set<number>();
  const irs = new Set<string>();
  const universes = new Set<string>();
  const quotas = new Set<string>();

  if (insertedDb && Array.isArray(insertedDb) && insertedDb.length > 0) {
    for (const row of insertedDb) {
      const rowMarket = getCanonicalCountryName(row.market || row.Market || row.Country || row.country || '').toLowerCase();
      if (rowMarket === clean) {
        let loiNum = Number(row.loi);
        if (isNaN(loiNum) || loiNum <= 0) loiNum = Number(row.LOI);
        if (isNaN(loiNum) || loiNum <= 0) loiNum = Number(row['Length of Interview']);
        if (!isNaN(loiNum) && loiNum > 0) lois.add(loiNum);

        if (row.irPercent !== undefined && row.irPercent !== null && row.irPercent !== '') {
          const formatted = typeof row.irPercent === 'number'
            ? (row.irPercent > 1 ? `${row.irPercent}%` : `${Math.round(row.irPercent * 100)}%`)
            : String(row.irPercent);
          if (formatted) irs.add(formatted);
        } else if (row['ir%'] !== undefined && row['ir%'] !== null && row['ir%'] !== '') {
          const formatted = typeof row['ir%'] === 'number'
            ? (row['ir%'] > 1 ? `${row['ir%']}%` : `${Math.round(row['ir%'] * 100)}%`)
            : String(row['ir%']);
          if (formatted) irs.add(formatted);
        } else if (row['IR%'] !== undefined && row['IR%'] !== null && row['IR%'] !== '') {
          const formatted = typeof row['IR%'] === 'number'
            ? (row['IR%'] > 1 ? `${row['IR%']}%` : `${Math.round(row['IR%'] * 100)}%`)
            : String(row['IR%']);
          if (formatted) irs.add(formatted);
        }

        const univ = String(row.irUniverse || row['IR universe'] || row['ir universe'] || row.target || row.Universe || '').trim();
        if (univ) universes.add(univ);

        const q = String(row.quotas || row.Quotas || row.quota || '').trim();
        if (q) quotas.add(q);
      }
    }
  } else {
    const found = COUNTRY_SPECS_MAP[clean];
    if (found) {
      found.lois.forEach(l => lois.add(l));
      found.irs.forEach(ir => irs.add(ir));
      found.universes.forEach(u => universes.add(u));
      found.quotas.forEach(q => quotas.add(q));
    }
  }

  return {
    countryName: canonical || country || '',
    lois: Array.from(lois).sort((a, b) => a - b),
    irs: Array.from(irs),
    universes: Array.from(universes),
    quotas: Array.from(quotas)
  };
}

/**
 * Cascading specs retrieval for a pitch row:
 * 1. When a country is chosen (e.g. Egypt):
 *    - The variable (incidence universe) dropdown options ONLY show the variables
 *      available for that country in the database!
 * 2. When a variable is selected for that country (e.g. France -> 'gen pop 18-65yo'):
 *    - The LOI, IR%, and Quotas dropdown options ONLY show the values that exist in
 *      the database for that country + variable combination, highlighted as in-DB.
 *    - Users can still manually enter custom values.
 * 3. Aliases like UAE == United Arab Emirates, UK == United Kingdom, US == United States
 *    are fully normalized to canonical full names.
 */
export function getCountrySpecsByUniverse(
  country?: string,
  universe?: string,
  insertedDb?: any[]
): SpecsOptionsForPitch {
  const canonicalCountry = getCanonicalCountryName(country);
  const cleanCountry = canonicalCountry.toLowerCase();

  // If no country selected yet, fallback to global defaults
  if (!cleanCountry) {
    return {
      preExistingUniverses: [],
      preExistingLois: [],
      preExistingIrs: [],
      preExistingQuotas: [],
      universeDropdownOptions: GLOBAL_ALL_UNIVERSES,
      loiDropdownOptions: GLOBAL_ALL_LOIS,
      irDropdownOptions: GLOBAL_ALL_IRS,
      quotaDropdownOptions: GLOBAL_ALL_QUOTAS
    };
  }

  interface RowData {
    loi: number;
    irRaw: string;
    universe: string;
    quotas: string;
  }
  const countryRows: RowData[] = [];

  if (insertedDb && Array.isArray(insertedDb) && insertedDb.length > 0) {
    // When a custom/new database is present, take country variables exclusively from the new database
    for (const row of insertedDb) {
      const rowMarket = getCanonicalCountryName(row.market || row.Market || row.Country || row.country || '').toLowerCase();
      if (rowMarket === cleanCountry) {
        let loiNum = Number(row.loi);
        if (isNaN(loiNum) || loiNum <= 0) loiNum = Number(row.LOI);
        if (isNaN(loiNum) || loiNum <= 0) loiNum = Number(row['Length of Interview']);

        let irVal = '';
        if (row.irPercent !== undefined && row.irPercent !== null && row.irPercent !== '') {
          irVal = typeof row.irPercent === 'number'
            ? (row.irPercent > 1 ? `${row.irPercent}%` : `${Math.round(row.irPercent * 100)}%`)
            : String(row.irPercent);
        } else if (row['ir%'] !== undefined && row['ir%'] !== null && row['ir%'] !== '') {
          irVal = typeof row['ir%'] === 'number'
            ? (row['ir%'] > 1 ? `${row['ir%']}%` : `${Math.round(row['ir%'] * 100)}%`)
            : String(row['ir%']);
        } else if (row['IR%'] !== undefined && row['IR%'] !== null && row['IR%'] !== '') {
          irVal = typeof row['IR%'] === 'number'
            ? (row['IR%'] > 1 ? `${row['IR%']}%` : `${Math.round(row['IR%'] * 100)}%`)
            : String(row['IR%']);
        }

        const uVal = String(row.irUniverse || row['IR universe'] || row['ir universe'] || row.target || row.Universe || '').trim();
        const qVal = String(row.quotas || row.Quotas || row.quota || '').trim();

        if (loiNum > 0 || irVal || uVal || qVal) {
          countryRows.push({
            loi: !isNaN(loiNum) && loiNum > 0 ? loiNum : 0,
            irRaw: irVal,
            universe: uVal,
            quotas: qVal
          });
        }
      }
    }
  } else {
    // Default reference specs from attached database
    for (const spec of ATTACHED_REFERENCE_SPECS) {
      if (getCanonicalCountryName(spec.market).toLowerCase() === cleanCountry) {
        countryRows.push({
          loi: spec.loi,
          irRaw: spec.irRaw,
          universe: spec.universe ? spec.universe.trim() : '',
          quotas: spec.quotas ? spec.quotas.trim() : ''
        });
      }
    }
  }

  // Distinct universes for this country in the database
  const preExistingUniverses = Array.from(
    new Set(countryRows.map(r => r.universe).filter(Boolean))
  ).sort();

  // RULE: "daca aleg o tara, de ex. egypt, nu ar trebui sa vad variable ce nu exista pe egypt,
  // ar trebui sa vad doar ce este in lista de variabile de pe egypt."
  // When a country is chosen, the variable dropdown contains ONLY what is in the list for that country!
  const universeDropdownOptions = preExistingUniverses.length > 0
    ? preExistingUniverses
    : [];

  // All LOIs, IRs, and Quotas for this country across all universes
  const countryAllLois = Array.from(
    new Set(countryRows.map(r => r.loi).filter(l => l > 0))
  ).sort((a, b) => a - b);

  const countryAllIrs = Array.from(
    new Set(countryRows.map(r => r.irRaw).filter(Boolean))
  );

  const countryAllQuotas = Array.from(
    new Set(countryRows.map(r => r.quotas).filter(Boolean))
  ).sort();

  const cleanUniverse = String(universe || '').trim().toLowerCase();
  const matchingRows = cleanUniverse
    ? countryRows.filter(r => r.universe.trim().toLowerCase() === cleanUniverse)
    : [];

  if (cleanUniverse && matchingRows.length > 0) {
    // When a specific variable is chosen and exists in DB for this country:
    // Show only the LOI / Quotas / IR that belong to that (country, variable) combination
    const preExistingLois = Array.from(
      new Set(matchingRows.map(r => r.loi).filter(l => l > 0))
    ).sort((a, b) => a - b);

    const preExistingIrs = Array.from(
      new Set(matchingRows.map(r => r.irRaw).filter(Boolean))
    );

    const preExistingQuotas = Array.from(
      new Set(matchingRows.map(r => r.quotas).filter(Boolean))
    ).sort();

    const quotaDropdownOptions = Array.from(
      new Set(['No quotas', ...preExistingQuotas])
    );

    return {
      preExistingUniverses,
      preExistingLois,
      preExistingIrs,
      preExistingQuotas,
      universeDropdownOptions,
      loiDropdownOptions: GLOBAL_ALL_LOIS,
      irDropdownOptions: GLOBAL_ALL_IRS,
      quotaDropdownOptions
    };
  }

  if (cleanUniverse && matchingRows.length === 0) {
    // Custom variable entered that does not exist in DB for this country
    return {
      preExistingUniverses,
      preExistingLois: [],
      preExistingIrs: [],
      preExistingQuotas: [],
      universeDropdownOptions,
      loiDropdownOptions: GLOBAL_ALL_LOIS,
      irDropdownOptions: GLOBAL_ALL_IRS,
      quotaDropdownOptions: Array.from(new Set(['No quotas', ...(countryAllQuotas.length > 0 ? countryAllQuotas : GLOBAL_ALL_QUOTAS)]))
    };
  }

  // Fallback when no variable selected yet: show all pre-existing specs for this country
  return {
    preExistingUniverses,
    preExistingLois: countryAllLois,
    preExistingIrs: countryAllIrs,
    preExistingQuotas: countryAllQuotas,
    universeDropdownOptions,
    loiDropdownOptions: GLOBAL_ALL_LOIS,
    irDropdownOptions: GLOBAL_ALL_IRS,
    quotaDropdownOptions: Array.from(new Set(['No quotas', ...(countryAllQuotas.length > 0 ? countryAllQuotas : GLOBAL_ALL_QUOTAS)]))
  };
}
