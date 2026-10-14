import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  AlignmentType,
  ShadingType
} from 'docx';
import { FeasibilityRow, VendorTier } from '../types';

// Helper to create empty or spacing paragraphs
function spacingParagraph(sizeInPt = 12): Paragraph {
  return new Paragraph({
    spacing: { before: sizeInPt * 10, after: sizeInPt * 10 },
    children: []
  });
}

// Helper to format currency
function formatCurrency(val: any): string {
  const num = Number(val || 0);
  return `$${num.toFixed(2)}`;
}

// Helper to format percentage
function formatPercent(val: any): string {
  const num = Number(val || 0);
  return `${num}%`;
}

// Helper to create a styled heading
function styledHeading(text: string, headingLevel: any, color = "1A365D"): Paragraph {
  return new Paragraph({
    heading: headingLevel,
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text,
        bold: true,
        color,
        font: "Arial"
      })
    ]
  });
}

// Helper to create a standard paragraph
function styledParagraph(text: string, bold = false, italic = false, spacingAfter = 120): Paragraph {
  return new Paragraph({
    spacing: { after: spacingAfter },
    children: [
      new TextRun({
        text,
        bold,
        italics: italic,
        font: "Arial",
        size: 22 // 11pt
      })
    ]
  });
}

// Helper to create a bullet point
function styledBullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [
      new TextRun({
        text,
        font: "Arial",
        size: 22
      })
    ]
  });
}

// Helper to create a bullet point with mixed regular and bold runs
function styledBulletMixed(runs: { text: string; bold?: boolean; italics?: boolean; color?: string }[]): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: runs.map(r => new TextRun({
      text: r.text,
      bold: !!r.bold,
      italics: !!r.italics,
      color: r.color,
      font: "Arial",
      size: 22
    }))
  });
}

// Helper to create a table header cell
function headerCell(text: string): TableCell {
  return new TableCell({
    shading: {
      fill: "1A365D",
      type: ShadingType.CLEAR
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold: true,
            color: "FFFFFF",
            font: "Arial",
            size: 18 // 9pt
          })
        ]
      })
    ]
  });
}

// Helper to create a data cell
function dataCell(text: string, bgFill?: string, isBold = false, isRight = false): TableCell {
  return new TableCell({
    shading: bgFill ? { fill: bgFill, type: ShadingType.CLEAR } : undefined,
    children: [
      new Paragraph({
        alignment: isRight ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [
          new TextRun({
            text: String(text),
            font: "Arial",
            bold: isBold,
            size: 18 // 9pt
          })
        ]
      })
    ]
  });
}

/**
 * GENERATES ALL OPERATIONAL BLUEPRINT ELEMENTS FOR BRD AND SETUP MANUAL
 * Reflects identical rules with changed/new details emphasized in bold.
 */
function createBlueprintDocumentElements(isBRD = false): Paragraph[] {
  const p: Paragraph[] = [];
  
  if (isBRD) {
    p.push(styledHeading("3. PLATFORM OPERATIONS & BUSINESS LOGIC BLUEPRINT", HeadingLevel.HEADING_1));
    p.push(styledParagraph("Detailed Breakdown of Behind-The-Scenes Rules and Interactive Button Logic", true, false, 60));
    p.push(styledParagraph("SYSTEM WORKFLOWS, FEASIBILITY METRICS, AUTO-CALCULATIONS AND SETUP CONFIGURATIONS", false, true, 180));
    
    p.push(styledHeading("3.1 Feasibility Allocation Engine Rules", HeadingLevel.HEADING_2));
  } else {
    p.push(styledHeading("PLATFORM OPERATIONS & BUSINESS LOGIC BLUEPRINT", HeadingLevel.HEADING_1));
    p.push(styledParagraph("Detailed Breakdown of Behind-The-Scenes Rules and Interactive Button Logic", true, false, 60));
    p.push(styledParagraph("SYSTEM WORKFLOWS, FEASIBILITY METRICS, AUTO-CALCULATIONS AND SETUP CONFIGURATIONS", false, true, 180));
    
    p.push(styledHeading("1. FEASIBILITY ALLOCATION ENGINE RULES", HeadingLevel.HEADING_1));
  }
  
  p.push(styledParagraph("The platform embeds three discrete allocation strategies to calculate sample sizes and target CPIs across available panels. These rules maintain consistency across tabs:"));
  
  // A. Cost-Optimized Strategy
  p.push(styledHeading("A. Cost-Optimized Strategy (Cheapest CPI First)", isBRD ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2));
  p.push(styledBulletMixed([
    { text: "● Internal Maximization: The algorithm always satisfies demand first using the Internal Panel (proprietary pool) up to the specified maximum internal percent ceiling (default is 100%, or user-defined).", bold: false }
  ]));
  p.push(styledBulletMixed([
    { text: "● Internal 90% Near-Limit Diversity Rule: If the effective internal capacity can satisfy the target sample size but is within 10% above the target (effective internal capacity >= target and <= target * 1.10), the engine automatically limits internal allocation to 90% of the target. This forces the remaining 10% to be allocated across external vendors, ensuring panel diversity and preventing single-source exhaustion.", bold: true }
  ]));
  p.push(styledBulletMixed([
    { text: "● External sourcing: Any remaining unfilled quota is routed to active external Vendors. The vendors are sorted in ascending order based on their Cost Per Interview (CPI) rates.", bold: false }
  ]));
  p.push(styledBulletMixed([
    { text: "● New additional rule – if there are 2 vendors with similar costs (within $0.001), prioritize the capabilities (highest capacity) then the tier when deciding which one to use. If both cost and tier match, quality color flag acts as fallback: Green > Yellow > Orange.", bold: true }
  ]));
  p.push(styledBulletMixed([
    { text: "● Single Covering Vendor Preference: Prior to splitting quota among multiple vendors, the engine checks if a single candidate vendor can cover 100% of the remaining unfilled sample at a valid CPI. If one exists, it is prioritized to minimize multi-supplier overlap penalties.", bold: true }
  ]));
  p.push(styledBulletMixed([
    { text: "● Cap Boundaries: The engine will allocate up to the maximum vendor capacity. If additional demand remains, it falls over to the next cheapest vendor.", bold: false }
  ]));
  p.push(styledBulletMixed([
    { text: "● Targeted CPI Cap Enforcement: If a targeted CPI limit is defined on the row (Targeted CPI > 0), any vendor whose cost per interview exceeds this threshold is strictly excluded from automated allocation.", bold: true }
  ]));

  // B. Tier Priority Strategy
  p.push(styledHeading("B. Tier Priority Strategy (Quality Vetting Model)", isBRD ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2));
  p.push(styledBulletMixed([
    { text: "● Internal Maximization: Starts by exhausting the Internal Panel (proprietary pool).", bold: false }
  ]));
  p.push(styledBulletMixed([
    { text: "● Vetting Tiers: Remaining sample sizes are assigned based on strict Vendor Tiers: Tier 0 (Vendor 1), followed by Tier 1 (Vendor 2), Tier 2 (Vendor 3), and Tier 3 (Vendor 4).", bold: false }
  ]));
  p.push(styledBulletMixed([
    { text: "● Tier Hierarchy & Unassigned Vetting: Suppliers from the database pool without an assigned tier default to Priority Level 4 (placed strictly behind Tier 3).", bold: true }
  ]));
  p.push(styledBulletMixed([
    { text: "● Quality Sorting: If CPIs differ within the same Tier, cheaper CPIs are prioritized. This guarantees highest programmatic panel quality.", bold: false }
  ]));
  p.push(styledBulletMixed([
    { text: "● New additional rule – if there are 2 vendors with similar costs, prioritize the capabilities as additional rule. The full sorting precedence evaluates: (1) Vendor Tier > (2) Quality Color Flag (Green > Yellow > Orange) > (3) Lowest CPI > (4) Capabilities.", bold: true }
  ]));

  // C. No Internal Cost Strategy
  p.push(styledHeading("C. No Internal Cost Strategy (Bypassed Proprietary Pool)", isBRD ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2));
  p.push(styledBulletMixed([
    { text: "● Zero Internal Allocation: Bypasses the Internal Panel completely, forcing its allocated sample to exactly 0 to study external-only panel procurement impact.", bold: false }
  ]));
  p.push(styledBulletMixed([
    { text: "● Fallback Sourcing: Routes 100% of the target sample structure to the paid external Vendors using cheapest-first CPI.", bold: false }
  ]));
  p.push(styledBulletMixed([
    { text: "● New additional rule – If external vendors have the exact same CPI, the engine prioritizes capabilities first (highest capacity), followed by Tier priority and quality color flag, ensuring maximum project feasibility.", bold: true }
  ]));

  // D. Composite Overlap Penalty Calculations
  p.push(styledHeading("D. Composite Overlap Penalty Calculations", isBRD ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2));
  p.push(styledBulletMixed([
    { text: "● Mechanism: Active panel overlaps degrades real-world capacity. The engine assesses separately utilized programmatic streams.", bold: false }
  ]));
  p.push(styledBulletMixed([
    { text: "● Scale of Penalties: 1 utilized panel = 0% penalty. 2 utilized panels = 20% penalty. More than 2 utilized panels = 20% + 5% additional increment per supplier, capped at a maximum ceiling of 50% (1 panel = 0%, 2 panels = 20%, 3 = 25%, 4 = 30%, 5 = 35%, 6 = 40%, >6 = 50%).", bold: false }
  ]));
  p.push(styledBulletMixed([
    { text: "● Capacity Impact: Effective capabilities and caps are reduced by multiplying raw volumes with (1 - penalty percentage). The engine iterates up to 10 cycles to converge allocations stably.", bold: false }
  ]));
  p.push(styledBulletMixed([
    { text: "● New additional rule – it impacts all the max potential feasibilities when applicable, including the internal one; the overlap, once applied, is applied on all potential capabilities from all the vendors. Cumulative Max Potential = (Internal + Total Vendor Capacities) * (1 - Overlap Penalty %).", bold: true }
  ]));
  p.push(styledBulletMixed([
    { text: "● Grid Column Overlap Representation: In the Database Grid, Vendor Max % columns dynamically display the overlap-penalized feasible capacity (rawCapacity * slider% * (1 - overlap%)). The Internal Max % column displays raw unpenalized database ratio (internal / target) unless a custom maximum internalization ceiling is applied.", bold: true }
  ]));
  p.push(styledBulletMixed([
    { text: "● Manual Overlap Override: Each row features an interactive Overlap dropdown allowing procurement leads to force fixed overlap values from 0% to 50% (in 5% increments) or leave on 'Auto' for dynamic formula calculation.", bold: true }
  ]));

  p.push(spacingParagraph(12));

  // Section 2: Interactive Button Workflows & Actions
  if (isBRD) {
    p.push(styledHeading("3.2 Interactive Button Workflows & Actions", HeadingLevel.HEADING_2));
  } else {
    p.push(styledHeading("2. INTERACTIVE BUTTON WORKFLOWS & ACTIONS", HeadingLevel.HEADING_1));
  }
  p.push(styledParagraph("Behind each interactive button is a strict set of logical action sequences. The categories of rules for key buttons are defined below:"));

  // A. 'Download BRD Document' Button
  p.push(styledHeading("A. 'Download BRD Document' Button (New Functional Requirement)", isBRD ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2));
  p.push(styledBulletMixed([
    { text: "● Purpose: Instantly compiles and downloads an executive-ready Business Requirements Document detailing backend frameworks, pseudocode, and firestore rules.", bold: false }
  ]));
  p.push(styledBulletMixed([
    { text: "● Logic Flow: Interrogates the active pitches and allocations, formats tables, and exports a raw .docx file entirely client-side with no external Google Drive dependencies.", bold: false }
  ]));
  p.push(styledBulletMixed([
    { text: "● System Navigation & Location: Currently accessible via the top-header 'Settings' dropdown menu labeled as Download BRD (.docx). An optional 'Create BRD in Google Docs' action is available when Google Workspace OAuth is connected.", bold: true }
  ]));

  // B. 'Download Setup Manual' Button
  p.push(styledHeading("B. 'Download Setup Manual' Button (New Functional Requirement)", isBRD ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2));
  p.push(styledBulletMixed([
    { text: "● Purpose: Generates this functional and administrative setup guide.", bold: false }
  ]));
  p.push(styledBulletMixed([
    { text: "● Logic Flow: Renders the categories of rules, calculations, and button action flows, delivering it directly to the local download folder.", bold: false }
  ]));
  p.push(styledBulletMixed([
    { text: "● System Navigation & Location: Currently located inside the header 'Settings' dropdown menu labeled as Download Setup (.docx). It is accompanied by a companion Download Board Deck (.pptx) button for executive slide deck exports.", bold: true }
  ]));

  // C. 'Check Feasibility' Button
  p.push(styledHeading("C. 'Check Feasibility' Button", isBRD ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2));
  p.push(styledBulletMixed([
    { text: "● Purpose: Performs active lookup auditing against capabilities databases.", bold: false }
  ]));
  p.push(styledBulletMixed([
    { text: "● Logic Flow: Pulls live supplier capacity sheets. If offline, it queries the locally uploaded database, computing filled sample percentages, blended CPI rates, operational profits, and alerts completion.", bold: false }
  ]));
  p.push(styledBulletMixed([
    { text: "● New additional rule: when checking for similar specs, if a vendor has different feasibilities in the database, higher/lower capabilities for the same specs, the higher capabilities will be prioritized;", bold: true }
  ]));
  p.push(styledBulletMixed([
    { text: "● The system won’t multiply the capabilities, using the same vendor’s capabilities from multiple rows, it will be used only once per option.", bold: true }
  ]));
  p.push(styledBulletMixed([
    { text: "● Three Distinct Evaluation Modes: The button provides a dropdown selection with 3 specialized workflows: (1) Feasibility for Targets (exact scenario targets), (2) Feasibility for Options (multi-scenario evaluation across pitch variations), and (3) Feasibility Optimized (unconstrained optimization across all 43 suppliers in the pool).", bold: true }
  ]));
  p.push(styledBulletMixed([
    { text: "● Manual Overrides Safeguard Modal: If manual overrides are active (custom panel blends, CPI overrides, or internal caps), clicking Check Feasibility triggers a confirmation prompt offering 'Reset & Run' (reverting to pure database defaults) or 'Keep & Run' (preserving custom user adjustments intact).", bold: true }
  ]));

  // D. 'Add New Vendor' Button
  p.push(styledHeading("D. 'Add New Vendor' Button", isBRD ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2));
  p.push(styledBulletMixed([
    { text: "● Purpose: Allows procurement leads to discover and enroll additional programmatic suppliers to tackle unfilled country deficits.", bold: false }
  ]));
  p.push(styledBulletMixed([
    { text: "● Logic Flow: Identifies active countries in specifications, compares them against unassigned suppliers inside the static Vendor Database Pool, selects the best matching vendor covering the highest number of active countries in your pitch, and appends the new supplier to the active workspace registry.", bold: false }
  ]));
  p.push(styledBulletMixed([
    { text: "● The new supplier won’t affect the current feasibility, it will have 0% share allocated, it will be used when manual share will be allocated.", bold: true }
  ]));
  p.push(styledBulletMixed([
    { text: "● The new suppliers will have their potential capabilities and prices from the database (same as the other ones)", bold: true }
  ]));
  p.push(styledBulletMixed([
    { text: "● Its capabilities will be added to the max feasible for each row and it will be impacted by the overlap (if overlap is applied)", bold: true }
  ]));
  p.push(styledBulletMixed([
    { text: "● Candidate Waterfall Algorithm: The system selects candidates using a strict 4-stage hierarchy: (1) Country Coverage Match Count > (2) Vendor Tier Quality (Tier 0 > 1 > 2 > 3) > (3) Quality Color Flag (Green > Yellow > Orange) > (4) Total Feasibility Volume.", bold: true }
  ]));
  p.push(styledBulletMixed([
    { text: "● Exhaustion Toast Alert: If no unassigned pool vendors cover active pitch countries, or all 43 suppliers have been added, the system displays an immediate notification: 'No vendors available'.", bold: true }
  ]));

  // E. 'Reset / Clear All Overrides' Button
  p.push(styledHeading("E. 'Reset / Clear All Overrides' Button", isBRD ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2));
  p.push(styledBulletMixed([
    { text: "● Purpose: Clears user-defined manual modifications to reset the optimization formulas.", bold: false }
  ]));
  p.push(styledBulletMixed([
    { text: "● Logic Flow: Resets all manual percent overrides (reverting to auto-allocation), clears custom maximum internalization values, and handles database clear-outs with optional backup recovery storage under the user's history dropdown.", bold: false }
  ]));
  p.push(styledBulletMixed([
    { text: "● Interface Label & Actions: Implemented in the Database Grid header as 'Reset Defaults'. Clicking opens a modal providing 'Save & Reset' (prompts for backup name, stores in local storage) and 'Reset Without Saving' (reverts to factory defaults).", bold: true }
  ]));

  p.push(spacingParagraph(12));

  // Section 3: High-Dialectic Runtime Logic
  if (isBRD) {
    p.push(styledHeading("3.3 High-Dialectic Runtime Logic", HeadingLevel.HEADING_2));
  } else {
    p.push(styledHeading("3. HIGH-DIALECTIC RUNTIME LOGIC", HeadingLevel.HEADING_1));
  }

  p.push(styledHeading("A. Real-Time Automatic Re-checking", isBRD ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2));
  p.push(styledParagraph(
    "To eliminate manual effort, any manual coordinate or specifications adjustment (such as typing a new country name, modifying target sample size, changing LOI values, or altering incidence index percentage) instantly and seamlessly triggers a silent, background feasibility check. This guarantees that your financial charts, total metrics, filling rates, and feasibility allocations are kept dynamically synchronized with zero friction."
  ));
  p.push(styledBulletMixed([
    { text: "● Toolbar Placement Specification: this will become a button on/off, called live feasibility – that will be added right after Insert Specs and Check feasibility (the button will be moved a little bit to the left, to have the same format as is now), when on it will do the background feasibility check, when off, the Feasibility optimized button have to be clicked to start the assessment.", bold: true }
  ]));
  p.push(styledBulletMixed([
    { text: "● Current Codebase Note: Live Feasibility is currently integrated within the Settings dropdown menu (Settings > Feasibility Mode). Moving it to the main toolbar beside Insert Specs completes this UX requirement.", bold: true }
  ]));

  p.push(styledHeading("B. Country Autocomplete Dropdown", isBRD ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2));
  p.push(styledParagraph(
    "Input text fields for Country and Market are enriched with a universal Autocomplete feature. Users can type any fragment of a country name, and a responsive dropdown filtered in real-time will appear. This eliminates spelling errors and ensures proper capabilities lookup matching."
  ));
  p.push(styledBulletMixed([
    { text: "● Global ISO Taxonomy: Powered by a standardized datalist (#country-datalist) containing all recognized global sovereign markets and territories.", bold: true }
  ]));
  p.push(styledBulletMixed([
    { text: "● Alphanumeric Normalization: User inputs and database records are normalized by lowercasing and stripping non-alphanumeric characters (.replace(/[^a-z0-9]/g, '')), ensuring seamless lookup matching across common variations (e.g. 'US' vs. 'United States', 'UK' vs. 'United Kingdom').", bold: true }
  ]));

  p.push(spacingParagraph(16));
  p.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: 120, after: 120 },
    children: [
      new TextRun({
        text: "DataQuery Procurement AI — Operational Compliance Release Sign-off V1",
        italics: true,
        font: "Arial",
        size: 18,
        color: "718096"
      })
    ]
  }));

  return p;
}

/**
 * GENERATES AND DOWNLOADS THE BRD (BUSINESS REQUIREMENT DOCUMENT) WORD FILE
 */
export async function downloadBRDDocument(
  pitches: FeasibilityRow[], 
  allocations: any[], 
  activeStrategy: string, 
  vendors: VendorTier[],
  timezone: string
) {
  const timestamp = new Date().toLocaleDateString();
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // 1. Prepare Cover Page elements
  const children: any[] = [];

  children.push(spacingParagraph(36));

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: "SYSTEMS REQUIREMENTS & TECHNICAL BRD",
        bold: true,
        size: 56, // 28pt
        color: "1A365D",
        font: "Arial"
      })
    ]
  }));

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120 },
    children: [
      new TextRun({
        text: "DataQuery Procurement AI — Feasibility Cost Optimizer",
        bold: true,
        size: 32, // 16pt
        color: "2B6CB0",
        font: "Arial"
      })
    ]
  }));

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 480 },
    children: [
      new TextRun({
        text: "COMPLETE ENTERPRISE ARCHITECTURE, ACTIVE CASE STUDY BLUEPRINT & IT IMPLEMENTATION SPECS",
        italics: true,
        size: 20, // 10pt
        color: "4A5568",
        font: "Arial"
      })
    ]
  }));

  children.push(spacingParagraph(24));

  // Meta table on cover page
  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          dataCell("Technical Blueprint Reference", "EBF8FF", true),
          dataCell("DQ-BRD-SYS-2026-V2")
        ]
      }),
      new TableRow({
        children: [
          dataCell("Prepared For", "EBF8FF", true),
          dataCell("Engineering & IT Integration Teams / Global Product Operations")
        ]
      }),
      new TableRow({
        children: [
          dataCell("Prepared By", "EBF8FF", true),
          dataCell("DataQuery Principal Integration Systems Architect")
        ]
      }),
      new TableRow({
        children: [
          dataCell("Release Version", "EBF8FF", true),
          dataCell("Enterprise Production Release V2.0")
        ]
      }),
      new TableRow({
        children: [
          dataCell("Current Platform Strategy", "EBF8FF", true),
          dataCell(activeStrategy.toUpperCase())
        ]
      }),
      new TableRow({
        children: [
          dataCell("Local Operational Timezone", "EBF8FF", true),
          dataCell(`${timezone} (Downloaded: ${timestamp} ${timeStr})`)
        ]
      }),
      new TableRow({
        children: [
          dataCell("Approval Status", "EBF8FF", true),
          dataCell("IT BOARD SIGN-OFF READY — DOCKED FOR IMMEDIATE PRODUCTION DEPLOYMENT", "F0FFF4", true)
        ]
      })
    ]
  });
  children.push(metaTable);

  children.push(spacingParagraph(36));

  // Section 1: Executive Summary & Enterprise Objective
  children.push(styledHeading("1. EXECUTIVE SUMMARY & ENTERPRISE OBJECTIVE", HeadingLevel.HEADING_1));
  children.push(styledParagraph(
    "The global market research landscape operates under severe, high-frequency quoting deadlines and margin erosion. Project Operations teams are tasked with parsing high-volume specification matrices (containing target sample sizes, incidence rates, local quotas, and study wave distributions) and calculating complex feasibility solutions. Procurement leads currently spend excessive hours manually allocating sample shares across internal panels and external panel suppliers (Vendors 1-4). This manual mapping results in sub-optimal partner selection, massive panel collision penalty markups, and missed pricing opportunities."
  ));
  children.push(styledParagraph(
    "The core mission of the DataQuery Procurement AI Sample Feasibility & Cost Optimizer is to automate this decision tree. By building a high-performance optimization matrix system, the platform balances multiple operational parameters in real time. The solver prioritizes cheap internal proprietary panels, dynamically checks vendor quality tiers and CPI values, factors in progressive multi-provider overlap penalties, and allows human Procurement Analysts to declare specific manual target overrides (the 'Price Tweaker' engine) to satisfy locked client requirements. This system reduces quoting latency from hours to seconds and secures optimal gross margins on all bids."
  ));

  children.push(styledHeading("Core Strategic Pillars of the System:", HeadingLevel.HEADING_2));
  children.push(styledBullet("Margin Preservation: Prioritizing proprietary Internal panel (internal cost model at $2.00) first, and only using paid tier partners when capacities or ceiling restrictions (maxInternalPercent) demand it."));
  children.push(styledBullet("Operational Agility: Automatically matching and populating incoming targets against local database capabilities and Google Sheets live matrices to reduce manual data reentry errors."));
  children.push(styledBullet("Risk Management: Factoring in progressive overlap penalties (e.g. 20% for 2 partners, then +5% per partner up to a 50% max) to ensure actual combined feasibility doesn't collapse on multi-vendor studies."));

  // Section 2: System Scope & Core Business Domain Model
  children.push(styledHeading("2. SYSTEM SCOPE & CORE BUSINESS DOMAIN MODEL", HeadingLevel.HEADING_1));
  children.push(styledParagraph(
    "DataQuery Procurement AI is a robust full-stack application leveraging lightweight TypeScript. To ensure clean separations between the browser view and secure credentials handling, the system maps logical columns directly to automated backend processes. The application maintains strict boundaries:"
  ));

  const scopeTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          headerCell("Functional Area"),
          headerCell("In-Scope (System Boundaries)")
        ]
      }),
      new TableRow({
        children: [
          dataCell("Specification Intake", undefined, true),
          dataCell("Ingesting Country, Target Sample, LOI, IR, Universe context, Quotas, Waves, and customizable Vendor capacities. Direct input grids supporting spreadsheet uploading and live cells.")
        ]
      }),
      new TableRow({
        children: [
          dataCell("Automated Optimizer", undefined, true),
          dataCell("Dynamic solver utilizing three mathematical sorting strategies: Cost Per Interview (cost), Tier ranking, and Internal Panel Exclusion (no-internal-cost).")
        ]
      }),
      new TableRow({
        children: [
          dataCell("Price Tweaker (Overrides)", undefined, true),
          dataCell("Enables procurement analyst to enforce specific % allotments (e.g. 30% of target locked to V1) while the rest of the target size is dynamically distributed by the algorithm.")
        ]
      }),
      new TableRow({
        children: [
          dataCell("Systems Integrations", undefined, true),
          dataCell("Self-hosted Flask server with a shared SQLite store for the capability lookup database and saved scenario options, plus local CSV / Excel exports.")
        ]
      })
    ]
  });
  children.push(scopeTable);
  children.push(spacingParagraph(12));

  // Section 3: Platform Operations & Business Logic Blueprint (Detailed Rules & Interactive Button Logic)
  children.push(...createBlueprintDocumentElements(true));
  children.push(spacingParagraph(12));

  // Section 4: Active Feasibility Options & Project Specifications
  children.push(styledHeading("4. ACTIVE FEASIBILITY OPTION SPECIFICATIONS", HeadingLevel.HEADING_1));
  children.push(styledParagraph(
    `This section compiles the active Option Specifications currently configured in the matrix workspace. There are currently ${pitches.length} country targets defined for this scenario.`
  ));

  if (pitches.length === 0) {
    children.push(styledParagraph("No active specification lines defined. Pre-populating baseline specifications template...", false, true));
  } else {
    // Build actual specifications table from pitches array
    const pitchHeaderRows = [
      new TableRow({
        children: [
          headerCell("Market"),
          headerCell("Target"),
          headerCell("LOI (min)"),
          headerCell("IR %"),
          headerCell("Waves"),
          headerCell("Target Size"),
          headerCell("Internal Cap"),
          headerCell("Max Int. %"),
          headerCell("Sales CPI"),
          headerCell("Lock Status")
        ]
      })
    ];

    const pitchRows = pitches.map(p => {
      const lockLabel = p.isLocked ? "LOCKED" : "UNLOCKED";
      const bg = p.isLocked ? "FEFCBF" : undefined; // soft yellow for locked
      return new TableRow({
        children: [
          dataCell(p.market, bg, true),
          dataCell(p.target || "N/A", bg),
          dataCell(String(p.loi || 0), bg, false, true),
          dataCell(formatPercent((p.irPercent || 0) * (p.irPercent < 1 ? 100 : 1)), bg, false, true),
          dataCell(String(p.waves || 1), bg, false, true),
          dataCell(String(p.totalSampleSize || 0), bg, true, true),
          dataCell(String(p.internal || 0), bg, false, true),
          dataCell(formatPercent(p.maxInternalPercent !== undefined ? p.maxInternalPercent : 100), bg, false, true),
          dataCell(formatCurrency(p.salesCpi || 0), bg, false, true),
          dataCell(lockLabel, bg, p.isLocked)
        ]
      });
    });

    const activePitchesTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [...pitchHeaderRows, ...pitchRows]
    });
    children.push(activePitchesTable);
  }
  children.push(spacingParagraph(12));

  // Section 5: Dynamic Sourcing Allocations & Financial Analysis
  children.push(styledHeading("5. FEASIBILITY ROUTING ALLOCATIONS & FINANCIAL METRICS", HeadingLevel.HEADING_1));
  children.push(styledParagraph(
    "The Feasibility Cost Optimizer calculates routing allocations in real-time across available providers. Below are the active allocations and financial outcomes computed by the core mathematical solver:"
  ));

  if (allocations.length === 0) {
    children.push(styledParagraph("Feasibility check has not been executed yet. Execute check inside the platform to generate dynamic allocation values.", false, true));
  } else {
    // Detailed allocations table
    const allocHeaders = [
      new TableRow({
        children: [
          headerCell("Market"),
          headerCell("Target Size"),
          headerCell("Internal Allocated"),
          headerCell("Vendor 1"),
          headerCell("Vendor 2"),
          headerCell("Vendor 3"),
          headerCell("Vendor 4"),
          headerCell("Unfilled Sample"),
          headerCell("Status")
        ]
      })
    ];

    const allocRows = allocations.map(a => {
      const pitch = pitches.find(p => p.id === a.rowId);
      const marketName = pitch ? pitch.market : `Row ${a.rowId}`;
      const targetSize = pitch ? pitch.totalSampleSize : 0;
      
      let statusFill = "F0FFF4"; // Green for feasible
      if (a.status === "Risk") statusFill = "FEFCBF"; // Yellow
      if (a.status === "Unfeasible") statusFill = "FDE8E8"; // Red

      return new TableRow({
        children: [
          dataCell(marketName, undefined, true),
          dataCell(String(targetSize), undefined, false, true),
          dataCell(String(a.allocatedInternal || 0), undefined, false, true),
          dataCell(String(a.allocatedVendor1 || 0), undefined, false, true),
          dataCell(String(a.allocatedVendor2 || 0), undefined, false, true),
          dataCell(String(a.allocatedVendor3 || 0), undefined, false, true),
          dataCell(String(a.allocatedVendor4 || 0), undefined, false, true),
          dataCell(String(a.unfilledSample || 0), a.unfilledSample > 0 ? "FDE8E8" : undefined, a.unfilledSample > 0, true),
          dataCell(String(a.status || "Unfeasible"), statusFill, true)
        ]
      });
    });

    const allocTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [...allocHeaders, ...allocRows]
    });
    children.push(allocTable);

    children.push(spacingParagraph(12));
    children.push(styledHeading("5.2 Enterprise Scenario Financial Totals", HeadingLevel.HEADING_2));

    // Calculate sum totals
    const totalSample = allocations.reduce((sum, a) => {
      const pitch = pitches.find(p => p.id === a.rowId);
      return sum + (pitch ? pitch.totalSampleSize : 0);
    }, 0);
    const totalAllocated = allocations.reduce((sum, a) => sum + (a.totalAllocated || 0), 0);
    const totalCostVal = allocations.reduce((sum, a) => sum + (a.totalCost || 0), 0);
    const totalRevenueVal = allocations.reduce((sum, a) => {
      const pitch = pitches.find(p => p.id === a.rowId);
      const sales = pitch ? (pitch.salesCpi || 0) : 0;
      const alloc = a.totalAllocated || 0;
      return sum + (sales * alloc);
    }, 0);
    const totalProfitVal = totalRevenueVal - totalCostVal;
    const gpMargin = totalRevenueVal > 0 ? (totalProfitVal / totalRevenueVal) * 100 : 0;

    const financeTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            dataCell("Metric KPI Description", "F7FAFC", true),
            dataCell("Aggregated Portfolio Value", "F7FAFC", true, true)
          ]
        }),
        new TableRow({
          children: [
            dataCell("Total Portfolio Target Sample"),
            dataCell(String(totalSample), undefined, true, true)
          ]
        }),
        new TableRow({
          children: [
            dataCell("Total Feasible Sourced Sample"),
            dataCell(String(totalAllocated), undefined, false, true)
          ]
        }),
        new TableRow({
          children: [
            dataCell("Total Procurement External & Internal Cost"),
            dataCell(formatCurrency(totalCostVal), undefined, false, true)
          ]
        }),
        new TableRow({
          children: [
            dataCell("Projected Gross Client Revenue (Client CPI sales)"),
            dataCell(formatCurrency(totalRevenueVal), undefined, false, true)
          ]
        }),
        new TableRow({
          children: [
            dataCell("Operational Net Profit Contribution"),
            dataCell(formatCurrency(totalProfitVal), "F0FFF4", true, true)
          ]
        }),
        new TableRow({
          children: [
            dataCell("Projected Gross Profit Margin (%)"),
            dataCell(formatPercent(gpMargin), "EBF8FF", true, true)
          ]
        })
      ]
    });
    children.push(financeTable);
  }
  children.push(spacingParagraph(12));

  // Section 6: Logical Database Schema & NoSQL Model
  children.push(styledHeading("6. LOGICAL DATABASE SCHEMA & DATA SYSTEMS MODEL", HeadingLevel.HEADING_1));
  children.push(styledParagraph(
    "To implement this system, the IT development team must deploy the following NoSQL Firestore collection schema. All data models are represented inside the 'src/types.ts' layer of the repository, but require correct physical collection setup in Firestore."
  ));

  children.push(styledHeading("6.1 Collection: 'users' (User Profiles & Tokens)", HeadingLevel.HEADING_2));
  children.push(styledParagraph("Schema Blueprint Profile:"));
  children.push(styledBullet("userId: STRING (Primary Key / FirebaseAuth UID)"));
  children.push(styledBullet("email: STRING (e.g. user@enterprise.com)"));
  children.push(styledBullet("displayName: STRING"));
  children.push(styledBullet("createdAt: TIMESTAMP"));
  children.push(styledBullet("lastLogin: TIMESTAMP"));
  children.push(styledBullet("storedToken: STRING (Encrypted OAuth Access Token)"));

  children.push(styledHeading("6.2 Collection: 'scenarios' (Scenario Meta Profiles)", HeadingLevel.HEADING_2));
  children.push(styledBullet("scenarioId: STRING (Primary Key)"));
  children.push(styledBullet("userId: STRING (Foreign Key referencing users.userId)"));
  children.push(styledBullet("scenarioName: STRING (e.g. Consumer Tracker Q3 Update)"));
  children.push(styledBullet("createdAt: TIMESTAMP"));
  children.push(styledBullet("updatedAt: TIMESTAMP"));
  children.push(styledBullet("activeStrategy: ENUM STRING ('cost' | 'tier' | 'no-internal-cost')"));

  children.push(styledHeading("6.3 Collection: 'pitches' (Specification Feasibility Rows)", HeadingLevel.HEADING_2));
  children.push(styledParagraph("Contains the individual market configuration columns. Maps directly to the spreadsheet grid input dataset:"));
  children.push(styledBullet("id: STRING (Primary Key)"));
  children.push(styledBullet("scenarioId: STRING (Foreign Key referencing scenarios.scenarioId)"));
  children.push(styledBullet("pitchName: STRING (e.g. Global Consumer Tracker)"));
  children.push(styledBullet("market: STRING (e.g. Germany)"));
  children.push(styledBullet("target: STRING (e.g. Gen Pop Carbonated Sparkling)"));
  children.push(styledBullet("loi: NUMBER (Interval, e.g. 15)"));
  children.push(styledBullet("irPercent: NUMBER (Incidence Rate, integer percentage e.g. 75)"));
  children.push(styledBullet("irUniverse: STRING"));
  children.push(styledBullet("waves: NUMBER (integer)"));
  children.push(styledBullet("totalFreshSample: NUMBER (integer, e.g. 2000)"));
  children.push(styledBullet("totalSampleSize: NUMBER (Target Sample Needed, integer e.g. 2500)"));
  children.push(styledBullet("internal: NUMBER (Internal Panel Cap, integer e.g. 2000)"));
  children.push(styledBullet("maxInternalPercent: NUMBER (e.g. 50)"));
  children.push(styledBullet("vendor1: NUMBER (Vendor 1 Max Cap)"));
  children.push(styledBullet("vendor1Cpi: NUMBER (Double, e.g. 3.00)"));
  children.push(styledBullet("vendor1Pct: NUMBER (Price Tweaker override allocation %)"));
  children.push(styledBullet("vendor2: NUMBER (Vendor 2 Max Cap)"));
  children.push(styledBullet("vendor2Cpi: NUMBER (Double, e.g. 3.50)"));
  children.push(styledBullet("vendor2Pct: NUMBER (override %)"));
  children.push(styledBullet("vendor3: NUMBER (Vendor 3 Max Cap)"));
  children.push(styledBullet("vendor3Cpi: NUMBER (Double, e.g. 4.10)"));
  children.push(styledBullet("vendor3Pct: NUMBER (override %)"));
  children.push(styledBullet("vendor4: NUMBER (Vendor 4 Max Cap)"));
  children.push(styledBullet("vendor4Cpi: NUMBER (Double, e.g. 4.90)"));
  children.push(styledBullet("vendor4Pct: NUMBER (override %)"));
  children.push(styledBullet("pmFee: NUMBER (Multiplier, e.g. 0.15)"));
  children.push(styledBullet("salesCpi: NUMBER (Selling Price per Interview CPI, e.g. 6.00)"));

  children.push(spacingParagraph(12));

  // Section 7: Integration REST API Interface Contract
  children.push(styledHeading("7. INTEGRATION REST API INTERFACE CONTRACT", HeadingLevel.HEADING_1));
  children.push(styledParagraph(
    "The system integrates front-end actions with secure back-end cloud processing via custom Express endpoint boundaries. The following endpoints must be fully implemented and secured by the IT integration team:"
  ));

  children.push(styledHeading("7.1 Endpoint: POST /api/sheets (Google Sheets Writer)", HeadingLevel.HEADING_2));
  children.push(styledParagraph("Used to write and synchronize optimized allocations right back into a Google Sheet spreadsheet. Must support multipart request and Authorization OAuth headers."));
  children.push(styledBullet("Headers: Content-Type: application/json; Authorization: Bearer [User_OAuth_Token]"));
  children.push(styledBullet("Payload: { spreadsheetId: string, scenarioName: string, pitches: Pitch[], strategy: string, vendors: Vendor[] }"));
  children.push(styledBullet("Expected Response: { success: true, spreadsheetId: string, spreadsheetUrl: string, rowsWrittenCount: number }"));

  children.push(styledHeading("7.2 Endpoint: POST /api/chat (Rule-Based Procurement Engine)", HeadingLevel.HEADING_2));
  children.push(styledParagraph("Analyzes user analytical inquiries via the local deterministic procurement engine, returning insights and structured parameter update operations with zero AI dependencies."));
  children.push(styledBullet("Payload: { message: string, activeStrategy: string, activePitches: Pitch[], vendors: Vendor[] }"));
  children.push(styledBullet("Expected Response: { replyText: string, suggestedActions: Action[] }"));

  children.push(spacingParagraph(12));

  // Section 8: Mathematical Core Algorithm (Pseudocode)
  children.push(styledHeading("8. MATHEMATICAL CORE ALGORITHM (IMPLEMENTATION PSEUDOCODE)", HeadingLevel.HEADING_1));
  children.push(styledParagraph(
    "To secure identical numerical outputs between the front-end calculator UI and backend automation engines, engineers must implement the exact 10-iteration loop algorithm detailed below:"
  ));

  const pseudoLines = [
    "function calculateRowAllocation(pitch, activeStrategy, vendors):",
    "    targetDemand = pitch.totalSampleSize",
    "    penalty = pitch.overlap !== undefined ? (1 - pitch.overlap) : 1.0",
    "    o1 = round(targetDemand * (pitch.vendor1Pct / 100))",
    "    o2 = round(targetDemand * (pitch.vendor2Pct / 100))",
    "    o3 = round(targetDemand * (pitch.vendor3Pct / 100))",
    "    o4 = round(targetDemand * (pitch.vendor4Pct / 100))",
    "    totalOverrides = o1 + o2 + o3 + o4",
    "    allocV1 = o1; allocV2 = o2; allocV3 = o3; allocV4 = o4; allocInternal = 0;",
    "    for iteration = 1 to 10:",
    "        remainingDemand = targetDemand - totalOverrides",
    "        effInternalCap = pitch.internal * penalty",
    "        effV1Cap = pitch.vendor1 * penalty",
    "        effV2Cap = pitch.vendor2 * penalty",
    "        effV3Cap = pitch.vendor3 * penalty",
    "        effV4Cap = pitch.vendor4 * penalty",
    "        maxInternalAllowed = round(targetDemand * ((pitch.maxInternalPercent || 100) / 100))",
    "        // Internal 90% Near-Limit Diversity Rule: if near limit, force 10% external diversity",
    "        if effInternalCap >= targetDemand and effInternalCap <= targetDemand * 1.10:",
    "            maxInternalAllowed = min(maxInternalAllowed, round(targetDemand * 0.90))",
    "        if activeStrategy !== 'no-internal-cost' and remainingDemand > 0:",
    "            allocInternal = min(effInternalCap, remainingDemand, maxInternalAllowed)",
    "            remainingDemand = remainingDemand - allocInternal",
    "        else: allocInternal = 0",
    "        activePool = []",
    "        if (pitch.vendor1Pct == 0) activePool.push({ id: 1, cap: effV1Cap, cpi: pitch.vendor1Cpi, tier: v1.tier, color: v1.color })",
    "        if (pitch.vendor2Pct == 0) activePool.push({ id: 2, cap: effV2Cap, cpi: pitch.vendor2Cpi, tier: v2.tier, color: v2.color })",
    "        if (pitch.vendor3Pct == 0) activePool.push({ id: 3, cap: effV3Cap, cpi: pitch.vendor3Cpi, tier: v3.tier, color: v3.color })",
    "        if (pitch.vendor4Pct == 0) activePool.push({ id: 4, cap: effV4Cap, cpi: pitch.vendor4Cpi, tier: v4.tier, color: v4.color })",
    "        // Targeted CPI Filter: exclude vendors exceeding target CPI cap threshold",
    "        if pitch.targetedCpi > 0: activePool = activePool.filter(v => v.cpi <= pitch.targetedCpi)",
    "        // Single Covering Vendor Preference",
    "        covering = activePool.find(v => v.cap >= remainingDemand)",
    "        if covering: activePool = [covering, ...activePool.filter(v => v.id !== covering.id)]",
    "        else if activeStrategy == 'cost' or activeStrategy == 'no-internal-cost':",
    "            Sort activePool: lowest CPI -> highest Capacity (tie-break) -> lowest Tier -> Color (Green>Yellow>Orange)",
    "        else if activeStrategy == 'tier':",
    "            Sort activePool: lowest Tier -> Color (Green>Yellow>Orange) -> lowest CPI -> highest Capacity",
    "        for v in activePool:",
    "            if remainingDemand > 0:",
    "                allocated = min(v.cap, remainingDemand)",
    "                remainingDemand = remainingDemand - allocated",
    "                if v.id == 1: allocV1 = allocated + o1",
    "                if v.id == 2: allocV2 = allocated + o2",
    "                if v.id == 3: allocV3 = allocated + o3",
    "                if v.id == 4: allocV4 = allocated + o4",
    "        activeSourcesCount = 0",
    "        if allocInternal > 0: activeSourcesCount++",
    "        if allocV1 > 0: activeSourcesCount++",
    "        if allocV2 > 0: activeSourcesCount++",
    "        if allocV3 > 0: activeSourcesCount++",
    "        if allocV4 > 0: activeSourcesCount++",
    "        if pitch.overlap !== undefined: penaltyRate = pitch.overlap",
    "        else:",
    "            if activeSourcesCount <= 1: penaltyRate = 0.0",
    "            else if activeSourcesCount == 2: penaltyRate = 0.20",
    "            else: penaltyRate = min(0.50, 0.20 + (activeSourcesCount - 2) * 0.05)",
    "        penalty = 1.0 - penaltyRate",
    "    return { allocatedInternal, allocatedVendor1, allocatedVendor2, allocatedVendor3, allocatedVendor4, unfilledSample }"
  ];

  pseudoLines.forEach(line => {
    children.push(new Paragraph({
      spacing: { after: 30 },
      indent: { left: 360 },
      children: [
        new TextRun({
          text: line,
          font: "Courier New",
          size: 16 // 8pt
        })
      ]
    }));
  });

  children.push(spacingParagraph(12));

  // Section 9: Platform Security Framework & Hook Rules
  children.push(styledHeading("9. PLATFORM SECURITY FRAMEWORK & HOOK RULES", HeadingLevel.HEADING_1));
  children.push(styledParagraph(
    "To guarantee strict enterprise compliance and data boundaries, firestore.rules must be configured with secure read-write protections. This blocks external supplier divisions from accessing underlying pricing engines or operational margins:"
  ));

  const ruleLines = [
    "rules_version = '2';",
    "service cloud.firestore {",
    "  match /databases/{database}/documents {",
    "    match /users/{userId} {",
    "      allow read, write: if request.auth != null && request.auth.uid == userId;",
    "    }",
    "    match /scenarios/{scenarioId} {",
    "      allow create: if request.auth != null;",
    "      allow read, update, delete: if request.auth != null && resource.data.userId == request.auth.uid;",
    "    }",
    "    match /pitches/{pitchId} {",
    "      allow create: if request.auth != null;",
    "      allow read, write: if request.auth != null && get(/databases/$(database)/documents/scenarios/$(request.resource.data.scenarioId || resource.data.scenarioId)).data.userId == request.auth.uid;",
    "    }",
    "  }",
    "}"
  ];

  ruleLines.forEach(line => {
    children.push(new Paragraph({
      spacing: { after: 30 },
      indent: { left: 360 },
      children: [
        new TextRun({
          text: line,
          font: "Courier New",
          size: 16
        })
      ]
    }));
  });

  children.push(spacingParagraph(12));

  // Section 10: Quality Assurance UAT Verification Test-Cases
  children.push(styledHeading("10. QUALITY ASSURANCE UAT VERIFICATION TEST-CASES", HeadingLevel.HEADING_1));
  children.push(styledParagraph(
    "IT Quality Assurance leads must execute the following User Acceptance Testing (UAT) scripts to verify platform accuracy before signing off on final deployment:"
  ));

  children.push(styledHeading("Test Script UAT-01: Correct Multi-Source Allocation with Overlap Penalty", HeadingLevel.HEADING_2));
  children.push(styledBullet("Setup Input: Germany Target=2,500, LOI=15, IR=75%. Internal Cap=2,000, Max Internal %=100. Vendor 1 Cap=1,000. Vendor 2 Cap=500. Strategy = Cost."));
  children.push(styledBullet("Expected Behavior: Proprietary panel takes 2,000. Remaining demand is 500. System maps 500 to Vendor 1."));
  children.push(styledBullet("Validation criteria: Total active panels is 2. Overlap penalty of 20% triggers. Effective internal cap drops to 1,600. Effective V1 cap drops to 800. Iterative loop recalibrates active sources stably."));

  children.push(styledHeading("Test Script UAT-02: Global Brand Override Strict Lock", HeadingLevel.HEADING_2));
  children.push(styledBullet("Setup Input: USA Target=5,000. Double click V1 override cell and type '50' to input a 50% strict local quota lock."));
  children.push(styledBullet("Expected Behavior: V1 allocation locks directly in database to 2,500. The remaining 2,500 is subject to standard loop allocation rules (routing first to Internal panel up to the 60% maxInternalPercent ceiling limit of 3,000)."));
  children.push(styledBullet("Validation criteria: Germany vendor 1 records confirm exactly 2,500 allocated. Feasibility registers 'Fully Feasible' with zero compliance risks."));

  children.push(spacingParagraph(24));
  children.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [
      new TextRun({
        text: "DataQuery Enterprise Systems Engineering Division — IT Readiness Release Sign-off Complete",
        italics: true,
        font: "Arial",
        size: 18,
        color: "718096"
      })
    ]
  }));

  // Build document
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: children
      }
    ]
  });

  // Pack & Download
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `DataQuery_Procurement_AI_BRD_${timestamp.replace(/\//g, '-')}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * GENERATES AND DOWNLOADS THE SETUP MANUAL WORD FILE
 */
export async function downloadSetupManualDocument(
  pitches: FeasibilityRow[], 
  vendors: VendorTier[],
  timezone: string
) {
  const timestamp = new Date().toLocaleDateString();
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const children: any[] = [];

  children.push(spacingParagraph(36));

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: "PLATFORM OPERATIONS & BUSINESS LOGIC BLUEPRINT",
        bold: true,
        size: 48, // 24pt
        color: "1A365D",
        font: "Arial"
      })
    ]
  }));

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120 },
    children: [
      new TextRun({
        text: "Detailed Breakdown of Behind-The-Scenes Rules and Interactive Button Logic",
        bold: true,
        size: 28, // 14pt
        color: "2B6CB0",
        font: "Arial"
      })
    ]
  }));

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 480 },
    children: [
      new TextRun({
        text: "SYSTEM WORKFLOWS, FEASIBILITY METRICS, AUTO-CALCULATIONS AND SETUP CONFIGURATIONS",
        italics: true,
        size: 20, // 10pt
        color: "4A5568",
        font: "Arial"
      })
    ]
  }));

  children.push(spacingParagraph(24));

  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          dataCell("Rules Reference Document", "EBF8FF", true),
          dataCell("DQ-SETUP-RULES-2026-V1")
        ]
      }),
      new TableRow({
        children: [
          dataCell("Target Audience", "EBF8FF", true),
          dataCell("Procurement Teams, Program Managers, Operations Analysts & Auditing Teams")
        ]
      }),
      new TableRow({
        children: [
          dataCell("Doc Class", "EBF8FF", true),
          dataCell("Technical Specifications & Functional Reference Manual")
        ]
      }),
      new TableRow({
        children: [
          dataCell("Active Options Configured", "EBF8FF", true),
          dataCell(`${pitches.length} active option specs`)
        ]
      }),
      new TableRow({
        children: [
          dataCell("Local Operational Timezone", "EBF8FF", true),
          dataCell(`${timezone} (Downloaded: ${timestamp} ${timeStr})`)
        ]
      })
    ]
  });
  children.push(metaTable);

  children.push(spacingParagraph(36));

  // Platform Operations & Business Logic Blueprint (Detailed Rules & Interactive Button Logic)
  children.push(...createBlueprintDocumentElements(false));

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: children
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `DataQuery_Procurement_AI_Setup_Manual_${timestamp.replace(/\//g, '-')}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
