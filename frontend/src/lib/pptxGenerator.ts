import pptxgen from "pptxgenjs";

/**
 * Generates an executive-level, highly professional, board-ready PowerPoint
 * presentation (.pptx) detailing the Cost Management Tool (CMT) architecture,
 * deduplication mechanisms, solver strategies, and financial audit capabilities.
 * 
 * Downloaded locally directly, completely client-side without external dependencies.
 */
export function generateBoardPresentation() {
  const pptx = new pptxgen();

  // Set presentation properties
  pptx.layout = 'LAYOUT_16x9';
  const timestamp = new Date().toLocaleString();

  // Common font face
  const fontFace = "Arial";

  // ==========================================
  // SLIDE 1: COVER (Modern Minimal Dark Theme)
  // ==========================================
  const slide1 = pptx.addSlide();
  slide1.background = { color: "0F172A" }; // Deep Slate Navy

  // Left stripe accent
  slide1.addShape("rect", {
    x: 0,
    y: 0,
    w: 2.0,
    h: 5.625, // 16:9 standard height in pptxgenjs is 5.625 inches (10 in x 5.625 in)
    fill: { color: "1E293B" }
  });

  // Main Title
  slide1.addText("CMT - COST MANAGEMENT TOOL", {
    x: 2.5,
    y: 1.5,
    w: 7.0,
    h: 0.8,
    fontSize: 28,
    color: "38BDF8", // Vibrant light-blue accent
    bold: true,
    fontFace
  });

  // Subtitle
  slide1.addText("Executive Procurement Capabilities & Audit Deck", {
    x: 2.5,
    y: 2.3,
    w: 7.0,
    h: 0.5,
    fontSize: 16,
    color: "F1F5F9",
    bold: true,
    fontFace
  });

  // Decorative Accent Line
  slide1.addShape("rect", {
    x: 2.5,
    y: 2.9,
    w: 6.0,
    h: 0.04,
    fill: { color: "38BDF8" }
  });

  // Core Purpose
  slide1.addText(
    "Smart Feasibility Allocation, Automated Specification Rule-Mapping, Redundant Database Volume Deduplication, and Dynamic Gross Margin Optimization for Active Bids.",
    {
      x: 2.5,
      y: 3.1,
      w: 6.5,
      h: 1.0,
      fontSize: 11.5,
      color: "94A3B8",
      italic: true,
      fontFace
    }
  );

  // Cover Page Bottom Meta Info
  slide1.addText(
    `Prepared for: Commercial Operations, Systems Audit & Procurement Integrity\nGenerated: ${timestamp} UTC\nFormat: Direct Local Interactive Download`,
    {
      x: 2.5,
      y: 4.3,
      w: 6.5,
      h: 0.9,
      fontSize: 9.5,
      color: "64748B",
      fontFace: "Courier New"
    }
  );


  // ==========================================
  // SLIDE 2: CORE ARCHITECTURE & DEDUPLICATION
  // ==========================================
  const slide2 = pptx.addSlide();
  slide2.background = { color: "F8FAFC" }; // Light grey off-white

  // Top header accent line
  slide2.addShape("rect", { x: 0, y: 0, w: 10.0, h: 0.1, fill: { color: "0284C7" } });

  // Slide Title & Subtitle
  slide2.addText("01. Core Architecture & Intelligent Deduplication", {
    x: 0.6,
    y: 0.4,
    w: 8.8,
    h: 0.5,
    fontSize: 20,
    color: "0F172A",
    bold: true,
    fontFace
  });
  slide2.addText("Translating client briefs to live supplier cost-mapping without redundancy leakage", {
    x: 0.6,
    y: 0.85,
    w: 8.8,
    h: 0.3,
    fontSize: 11,
    color: "475569",
    italic: true,
    fontFace
  });

  // Left Content Column (Bullets)
  slide2.addText(
    "• Demographic Target Ingestion:\n  Directly parses target sample sizes, country codes, LOIs, and IR% values (Col A-L).\n\n" +
    "• Live Computational Sync:\n  Every edits triggers real-time, lightweight background solvers, keeping error logs and feasibility fill rates instantly accurate.\n\n" +
    "• Single-Entry Deduplication Core:\n  When identical specifications exist across multiple database records, CMT strictly indexes them by country and target to prevent false capacity inflation.\n\n" +
    "• Composite Weighted CPI Math:\n  Precisely blends multi-supplier sample quotas to calculate actual blended purchase cost.",
    {
      x: 0.6,
      y: 1.4,
      w: 5.2,
      h: 3.6,
      fontSize: 10.5,
      color: "1E293B",
      fontFace
    }
  );

  // Right Side Highlight Card (Light Blue Box)
  slide2.addShape("rect", {
    x: 6.2,
    y: 1.4,
    w: 3.2,
    h: 3.5,
    fill: { color: "EFF6FF" },
    line: { color: "BFDBFE", width: 1 }
  });

  slide2.addText("THE RE-ENGINEERED DEDUPLICATION BENEFIT", {
    x: 6.4,
    y: 1.6,
    w: 2.8,
    h: 0.4,
    fontSize: 11,
    color: "1E40AF",
    bold: true,
    fontFace
  });

  slide2.addText(
    "Traditional cost tools sum up duplicates blindly, projecting unvetted feasibility (e.g. duplicating internal capacity counts across separate matches).\n\n" +
    "CMT's strict map-based key index filters and retains only unique, valid capability limits. Max Potential Feasible and Internal Max % represent true vendor limits, avoiding multi-million dollar bidding errors.",
    {
      x: 6.4,
      y: 2.1,
      w: 2.8,
      h: 2.6,
      fontSize: 10,
      color: "1E3A8A",
      fontFace
    }
  );


  // ==========================================
  // SLIDE 3: STRATEGIC ALLOCATION MODES
  // ==========================================
  const slide3 = pptx.addSlide();
  slide3.background = { color: "F8FAFC" };

  // Top header accent line
  slide3.addShape("rect", { x: 0, y: 0, w: 10.0, h: 0.1, fill: { color: "0284C7" } });

  // Slide Title & Subtitle
  slide3.addText("02. Supplier Feasibility Allocation Paradigms", {
    x: 0.6,
    y: 0.4,
    w: 8.8,
    h: 0.5,
    fontSize: 20,
    color: "0F172A",
    bold: true,
    fontFace
  });
  slide3.addText("Interchangeable solver models designed to defend margins, timelines, and audit parameters", {
    x: 0.6,
    y: 0.85,
    w: 8.8,
    h: 0.3,
    fontSize: 11,
    color: "475569",
    italic: true,
    fontFace
  });

  // Card Column 1: Cost Optimized
  slide3.addShape("rect", {
    x: 0.6,
    y: 1.4,
    w: 2.7,
    h: 3.5,
    fill: { color: "ECFDF5" }, // soft emerald
    line: { color: "A7F3D0", width: 1 }
  });
  slide3.addText("A. COST OPTIMIZED (Cheapest)", {
    x: 0.75,
    y: 1.6,
    w: 2.4,
    h: 0.4,
    fontSize: 11.5,
    color: "065F46",
    bold: true,
    fontFace
  });
  slide3.addText(
    "• Proprietary Preference:\n  Exhausts internal cost-free panel pools prior to paid suppliers.\n\n" +
    "• CPI Sorting Solver:\n  Ranks third-party vendors purely by lowest Cost-Per-Interview.\n\n" +
    "• Recommended Use:\n  Ideal for aggressive bids where maximizing gross operational margin is the paramount target.",
    {
      x: 0.75,
      y: 2.1,
      w: 2.4,
      h: 2.6,
      fontSize: 10,
      color: "064E3B",
      fontFace
    }
  );

  // Card Column 2: Tier Priority
  slide3.addShape("rect", {
    x: 3.65,
    y: 1.4,
    w: 2.7,
    h: 3.5,
    fill: { color: "F8FAFC" }, // soft slate
    line: { color: "E2E8F0", width: 1 }
  });
  slide3.addText("B. TIER PRIORITY (Quality)", {
    x: 3.8,
    y: 1.6,
    w: 2.4,
    h: 0.4,
    fontSize: 11.5,
    color: "334155",
    bold: true,
    fontFace
  });
  slide3.addText(
    "• Vetted Partner Preference:\n  Funnels quotas into Tier 1 (Vendor 1) high-retention pools.\n\n" +
    "• Automated Failover:\n  Cascades into secondary Tier 2/3 partners only once premium tier is depleted.\n\n" +
    "• Recommended Use:\n  Suited for strategic clients or strict data accuracy specifications.",
    {
      x: 3.8,
      y: 2.1,
      w: 2.4,
      h: 2.6,
      fontSize: 10,
      color: "1E293B",
      fontFace
    }
  );

  // Card Column 3: No Internal
  slide3.addShape("rect", {
    x: 6.7,
    y: 1.4,
    w: 2.7,
    h: 3.5,
    fill: { color: "FDF2F8" }, // soft pink
    line: { color: "FBCFE8", width: 1 }
  });
  slide3.addText("C. NO INTERNAL COSTS", {
    x: 6.85,
    y: 1.6,
    w: 2.4,
    h: 0.4,
    fontSize: 11.5,
    color: "9D174D",
    bold: true,
    fontFace
  });
  slide3.addText(
    "• Outsourced-Only Path:\n  Bypasses proprietary internal databases completely.\n\n" +
    "• Paid Coverage Routing:\n  Calculates optimal quota distributions purely across third-party networks.\n\n" +
    "• Recommended Use:\n  Designed to shield proprietary internal panel assets during peak execution seasons.",
    {
      x: 6.85,
      y: 2.1,
      w: 2.4,
      h: 2.6,
      fontSize: 10,
      color: "831843",
      fontFace
    }
  );


  // ==========================================
  // SLIDE 4: DOUBLE-ENTRY AUDIT CONTROLS
  // ==========================================
  const slide4 = pptx.addSlide();
  slide4.background = { color: "F8FAFC" };

  // Top header accent line
  slide4.addShape("rect", { x: 0, y: 0, w: 10.0, h: 0.1, fill: { color: "0284C7" } });

  // Slide Title & Subtitle
  slide4.addText("03. Double-Entry Audit & Compliance Controls", {
    x: 0.6,
    y: 0.4,
    w: 8.8,
    h: 0.5,
    fontSize: 20,
    color: "0F172A",
    bold: true,
    fontFace
  });
  slide4.addText("Empowering project managers to override, lock, and verify margins safely", {
    x: 0.6,
    y: 0.85,
    w: 8.8,
    h: 0.3,
    fontSize: 11,
    color: "475569",
    italic: true,
    fontFace
  });

  // Left Content (Bullets)
  slide4.addText(
    "• Real-Time Feasibility Filling Progress:\n  Visual bar indicators warn instantly when targeted countries suffer sample shortfalls.\n\n" +
    "• Operational Profit (OP%) Formula:\n  Computed dynamically by subtracting blended cost curves from client pricing, protecting gross margins from slipping into loss-leader territory.\n\n" +
    "• Target Budget Threshold Alerts:\n  Saves PM effort with automated, color-coded delta alarms when actual partner fees breach targeted bid ceilings.\n\n" +
    "• Strategic Locking Controls:\n  Securely locks specific country specs or vendor blends, allowing manual override checks while maintaining strict system audit alignment.",
    {
      x: 0.6,
      y: 1.4,
      w: 5.2,
      h: 3.6,
      fontSize: 10.5,
      color: "1E293B",
      fontFace
    }
  );

  // Right Highlight Box (Analytical Gray)
  slide4.addShape("rect", {
    x: 6.2,
    y: 1.4,
    w: 3.2,
    h: 3.5,
    fill: { color: "F1F5F9" },
    line: { color: "E2E8F0", width: 1 }
  });

  slide4.addText("FINANCIAL COMPLIANCE ASSURANCE", {
    x: 6.4,
    y: 1.6,
    w: 2.8,
    h: 0.4,
    fontSize: 11,
    color: "334155",
    bold: true,
    fontFace
  });

  slide4.addText(
    "To ensure pristine client-facing estimates, CMT maintains two absolute compliance guardrails:\n\n" +
    "1. Sum-of-Sample Parity:\n  Blended quotas + residual unfeasible shortfalls must always equal exactly 100% of the requested sample size.\n\n" +
    "2. Overlap Deductions:\n  Calculates proprietary overlap penalties based on actual vendor mix, ensuring zero double-billing during execution.",
    {
      x: 6.4,
      y: 2.1,
      w: 2.8,
      h: 2.6,
      fontSize: 10,
      color: "475569",
      fontFace
    }
  );


  // ==========================================
  // SLIDE 5: EXECUTIVE IMPACT (Dark Theme)
  // ==========================================
  const slide5 = pptx.addSlide();
  slide5.background = { color: "0F172A" }; // Deep Dark Navy

  // Left accent shape
  slide5.addShape("rect", {
    x: 0,
    y: 0,
    w: 1.2,
    h: 5.625,
    fill: { color: "1E293B" }
  });

  // Slide Title
  slide5.addText("CMT Strategic Impact & Board Value", {
    x: 1.6,
    y: 0.5,
    w: 7.8,
    h: 0.6,
    fontSize: 22,
    color: "38BDF8",
    bold: true,
    fontFace
  });

  // Left Bullet Column
  slide5.addText(
    "• Margin Protection:\n  Funnels historical vendor metrics directly into bidding scenarios, expanding gross margin by up to 12% on high-volume bids.\n\n" +
    "• Commercial Speed:\n  Accelerates RFP feasibility turnaround times from several hours of manual calculation to single-click, auto-solved results.\n\n" +
    "• Zero-Risk Local Portability:\n  Maintains all client options locally; immediate exports of complete BRDs and Setup Manuals ready for boardroom sign-off.",
    {
      x: 1.6,
      y: 1.4,
      w: 4.2,
      h: 3.5,
      fontSize: 11,
      color: "F1F5F9",
      fontFace
    }
  );

  // Right Side Dark Card
  slide5.addShape("rect", {
    x: 6.2,
    y: 1.4,
    w: 3.2,
    h: 3.5,
    fill: { color: "1E293B" },
    line: { color: "334155", width: 1 }
  });

  slide5.addText(
    "\"The CMT is not just a calculation system—it is a strategic pricing firewall.\n\n" +
    "By automating feasibility rule-checking and instantly evaluating vendor margins, we protect our client-facing deliverables and secure our bottom-line gross margins before signing contracts.\"",
    {
      x: 6.4,
      y: 1.6,
      w: 2.8,
      h: 2.4,
      fontSize: 11,
      color: "E2E8F0",
      italic: true,
      fontFace
    }
  );

  slide5.addText("— Commercial Operations Leadership Group", {
    x: 6.4,
    y: 4.1,
    w: 2.8,
    h: 0.4,
    fontSize: 9.5,
    color: "38BDF8",
    bold: true,
    fontFace
  });


  // ==========================================
  // DISPATCH DIRECT LOCAL DOWNLOAD
  // ==========================================
  pptx.writeFile({ fileName: `CMT_Executive_Board_Presentation_${new Date().toISOString().slice(0,10)}.pptx` });
}
