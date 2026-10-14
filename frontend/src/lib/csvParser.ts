import { FeasibilityRow } from '../types';

export function parseCSVToPitches(csvText: string): FeasibilityRow[] {
  // Split content by line breaks, trim, and skip empty lines
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith(',,,,')); // skip helper tables divider lines

  if (lines.length < 2) {
    throw new Error('CSV file does not contain enough rows.');
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]);

  // Determine indices dynamically to handle slightly different column positions
  const getIndex = (aliases: string[], fallback: number): number => {
    const idx = headers.findIndex((h) =>
      aliases.some((alias) => h.toLowerCase().includes(alias.toLowerCase()))
    );
    return idx >= 0 ? idx : fallback;
  };

  const pitchIdx = getIndex(['pitch name', 'pitch'], 0);
  const sourceIdx = getIndex(['source'], 1);
  const optionIdx = getIndex(['option', 'opt', 'date'], 2);
  const marketIdx = getIndex(['market', 'country', 'field country'], 3);
  const targetIdx = getIndex(['target'], 4);
  const loiIdx = getIndex(['loi', 'length of interview'], 5);
  const irIdx = getIndex(['ir%', 'ir percent', 'incidence percentage'], 6);
  const irUnivIdx = getIndex(['ir universe', 'universe', 'incidence universe'], 7);
  const quotasIdx = getIndex(['quota', 'quotas'], 8);
  const wavesIdx = getIndex(['nr of waves', 'number of waves', 'wave', 'waves'], 9);
  const freshIdx = getIndex(['total fresh sample', 'total fresh', 'fresh sample'], 10);
  const totalIdx = getIndex(['total sample size (all waves)', 'total sample size', 'sample size', 'calculated'], 11);
  const iisIdx = getIndex(['internal', 'iis', 'internal panel', 'internal capabilities'], 12);

  // Dynamically detect all present vendor columns (e.g. "Vendor 1", "Vendor 5", "Vendor 23 cpi")
  interface VendorFieldConfig {
    num: number;
    capIdx: number;
    cpiIdx: number;
  }
  const vendorConfigs: VendorFieldConfig[] = [];

  headers.forEach((h, hIdx) => {
    const lower = h.toLowerCase().trim();
    // Look for things like "vendor 23 cpi", "v23 cpi", "vendor 2 c", "v2 c", "vendor 2 cost/rate/price"
    const cpiMatch = lower.match(/(?:vendor\s*|v)(\d+)\s*(?:cpi|c\b|cost|rate|price)/i);
    if (cpiMatch) {
      const num = parseInt(cpiMatch[1], 10);
      let config = vendorConfigs.find((c) => c.num === num);
      if (!config) {
        config = { num, capIdx: -1, cpiIdx: -1 };
        vendorConfigs.push(config);
      }
      config.cpiIdx = hIdx;
      return;
    }

    // Look for "vendor 23" or "v23" capacity (since CPI matched first, this is strictly the capacity column)
    const capMatch = lower.match(/(?:vendor\s*|v)(\d+)/i);
    if (capMatch) {
      const num = parseInt(capMatch[1], 10);
      let config = vendorConfigs.find((c) => c.num === num);
      if (!config) {
        config = { num, capIdx: -1, cpiIdx: -1 };
        vendorConfigs.push(config);
      }
      config.capIdx = hIdx;
      return;
    }
  });

  const parsedPitches: FeasibilityRow[] = [];

  // Parse data rows, stop if we see "Vendor name" at the start of line (start of auxiliary table)
  for (let i = 1; i < lines.length; i++) {
    const currentLine = lines[i];
    if (currentLine.toLowerCase().startsWith('vendor name,') || currentLine.toLowerCase().startsWith('vendor,')) {
      break; // End of pitches table, starts second helper table
    }

    const cols = parseCSVLine(currentLine);
    if (cols.length < 5 || !cols[pitchIdx]) {
      continue; // Skip invalid lines
    }

    const cleanNumber = (val: string): number => {
      if (!val) return 0;
      return Number(val.replace(/[^0-9.-]/g, '')) || 0;
    };

    const cleanPercent = (val: string): number => {
      if (!val) return 0.20; // fallback standard incidence
      if (val.includes('%')) {
        return cleanNumber(val) / 100;
      }
      const num = cleanNumber(val);
      return num > 1 ? num / 100 : num;
    };

    const rowObj: any = {
      id: `row-csv-${i}-${Date.now()}`,
      pitchName: cols[pitchIdx] || `Pitch ${i}`,
      source: cols[sourceIdx] || 'Custom Upload',
      option: cols[optionIdx] || '1',
      market: cols[marketIdx] || 'Global',
      target: cols[targetIdx] || 'Gen Pop',
      loi: cleanNumber(cols[loiIdx]) || 10,
      irPercent: cleanPercent(cols[irIdx]),
      irUniverse: cols[irUnivIdx] || 'General Population',
      quotas: cols[quotasIdx] || 'No quotas',
      waves: cleanNumber(cols[wavesIdx]) || 1,
      totalFreshSample: cleanNumber(cols[freshIdx]),
      totalSampleSize: cleanNumber(cols[totalIdx]) || cleanNumber(cols[freshIdx]),
      internal: cleanNumber(cols[iisIdx]),
    };

    // Dynamically assign all vendor values detected in the headers
    vendorConfigs.forEach((cfg) => {
      const capKey = `vendor${cfg.num}` as keyof FeasibilityRow & string;
      const cpiKey = `vendor${cfg.num}Cpi` as keyof FeasibilityRow & string;

      if (cfg.capIdx >= 0 && cols[cfg.capIdx] !== undefined) {
        rowObj[capKey] = cleanNumber(cols[cfg.capIdx]);
      } else {
        rowObj[capKey] = 0;
      }

      if (cfg.cpiIdx >= 0 && cols[cfg.cpiIdx] !== undefined) {
        rowObj[cpiKey] = cleanNumber(cols[cfg.cpiIdx]);
      } else {
        rowObj[cpiKey] = 0;
      }
    });

    // Support backward-compatible standard structure for layout engines up to at least 9
    for (let j = 1; j <= 9; j++) {
      if (rowObj[`vendor${j}` as keyof FeasibilityRow] === undefined) {
        rowObj[`vendor${j}` as any] = 0;
      }
      if (rowObj[`vendor${j}Cpi` as keyof FeasibilityRow] === undefined) {
        rowObj[`vendor${j}Cpi` as any] = 0;
      }
    }

    parsedPitches.push(rowObj);
  }

  return parsedPitches;
}

// Resilient CSV parser split line, respect surrounding quotes
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let currentToken = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(currentToken.trim());
      currentToken = '';
    } else {
      currentToken += char;
    }
  }
  result.push(currentToken.trim());
  return result;
}
