"""Deterministic rule-based feasibility & procurement assistant (no AI, no external calls).

Port of the `processRuleBasedQuery` engine from the original Express server.
The JS truthiness rules (`||` / `??`) are reproduced on purpose so the assistant
answers and edits rows exactly as before.
"""

import math
import random
import re
import time

COUNTRY_KEYWORDS = [
    "germany", "france", "spain", "italy", "romania", "canada", "australia",
    "japan", "uk", "united kingdom", "us", "usa", "united states",
]


def _or(value, default):
    """JS `value || default`."""
    return value if value else default


def _coalesce(value, default):
    """JS `value ?? default`."""
    return default if value is None else value


def _fmt(n):
    """Render a number the way a JS template literal would (1000.0 -> "1000")."""
    if isinstance(n, float) and n.is_integer():
        return str(int(n))
    return str(n)


def _num(value):
    """Numeric value or None, for comparisons that JS would make on `undefined`."""
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return value
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _search(pattern, text):
    return re.search(pattern, text, re.IGNORECASE)


def _detect_market(query):
    if "germany" in query or re.search(r"\bde\b", query):
        return "Germany"
    if "united kingdom" in query or "uk" in query:
        return "United Kingdom"
    if "france" in query or re.search(r"\bfr\b", query):
        return "France"
    if "romania" in query or re.search(r"\bro\b", query):
        return "Romania"
    if "canada" in query or re.search(r"\bca\b", query):
        return "Canada"
    if "spain" in query or re.search(r"\bes\b", query):
        return "Spain"
    if "italy" in query or re.search(r"\bit\b", query):
        return "Italy"
    if "australia" in query or re.search(r"\bau\b", query):
        return "Australia"
    if "japan" in query or re.search(r"\bjp\b", query):
        return "Japan"
    return "United States"


def process_rule_based_query(messages, data_state, active_strategy):
    last = messages[-1] if messages else None
    last_msg = (last.get("text") if isinstance(last, dict) else None) or ""
    query = last_msg.lower()

    data_state = data_state or {}
    original_pitches = data_state.get("pitches") or []
    pitches_map = {p.get("id"): dict(p) for p in original_pitches}
    default_source_row = original_pitches[0] if original_pitches else {}

    text = ""
    update_strategy = None
    has_modifications = False

    # 1. CHEAPEST / OPTIMIZE
    if any(k in query for k in ("cheapest", "optimize", "lowest cost", "cheapest version")):
        update_strategy = "cost"

        for pitch in pitches_map.values():
            pitch["maxInternalPercent"] = 100
            has_modifications = True

        text = (
            f"### 📁 What Was Checked\n\n"
            f"* Triggered local procurement cost optimization engine on **{len(original_pitches)} active scenarios**.\n\n"
            f"* Objective: Maximize use of zero-cost internal panel capabilities within fixed available vendor parameters.\n\n\n"
            f"### 💡 Solution & Allocation Analytics\n\n"
            f"* **Optimization Actions Applied**:\n"
            f"  1. Forced **maximum internal panel contribution to 100%** across all scenarios.\n"
            f"  2. Adjusted Calculation Strategy type to **\"cost\"** (Ascending order of Vendor CPI).\n\n"
            f"* **Resulting Status**: Feasibility is optimized using actual fixed vendor rates while maximizing "
            f"internal panel coverage. State representation synchronizes across all panels instantly."
        )

    # 2. ADD / INSERT NEW LINE / COUNTRY
    elif (
        any(k in query for k in (
            "add", "insert", "new line", "row", "target", "same specs", "same parameter",
            "same target", "what about", "how about",
        ))
        or (len(original_pitches) > 0 and any(c in query for c in COUNTRY_KEYWORDS))
    ):
        market = _detect_market(query)

        copied = original_pitches[-1] if original_pitches else default_source_row

        target_size = _or(copied.get("totalSampleSize"), 1000)
        size_match = (
            _search(r"(\d+)\s*target", last_msg)
            or _search(r"target\s*(?:of\s*)?(\d+)", last_msg)
            or _search(r"size\s*(?:of\s*)?(\d+)", last_msg)
        )
        if size_match:
            target_size = int(size_match.group(1))

        loi_val = _or(copied.get("loi"), 10)
        loi_match = _search(r"(\d+)\s*min", last_msg) or _search(r"loi\s*(?:of\s*)?(\d+)", last_msg)
        if loi_match:
            loi_val = int(loi_match.group(1))

        ir_percent_val = _or(copied.get("irPercent"), 0.3)
        ir_match = (
            _search(r"(\d+)%\s*incidence", last_msg)
            or _search(r"ir\s*(?:of\s*)?(\d+)%", last_msg)
            or _search(r"(\d+)%\s*ir", last_msg)
        )
        if ir_match:
            ir_percent_val = int(ir_match.group(1)) / 100

        internal_cap = copied["internal"] if "internal" in copied else 1500
        cap_match = (
            _search(r"internal\s*(?:capabilities\s*)?(?:of\s*)?(\d+)", last_msg)
            or _search(r"(\d+)\s*internal", last_msg)
        )
        if cap_match:
            internal_cap = int(cap_match.group(1))

        target_demographic = _or(copied.get("target"), "gen pop")
        target_match = _search(
            r"(?:target\s+)?(?:of\s+)?(mother[s]?\s+of\s+babies\s*[\d-]+\s*yo|mother[s]?\s+of\s+babies\s*[\w\s-]+)",
            last_msg,
        )
        if target_match:
            target_demographic = target_match.group(1).strip()
        elif "mother" in query:
            target_demographic = "mothers of babies 1-10yo"

        new_id = f"row-proc-{int(time.time() * 1000)}-{random.randint(0, 9999)}"
        option_num = str(len(pitches_map) + 1)

        new_row = {
            "id": new_id,
            "pitchName": _or(copied.get("pitchName"), "Pitch 1"),
            "source": "Manual Spec Add",
            "option": option_num,
            "market": market,
            "target": target_demographic,
            "loi": loi_val,
            "irPercent": ir_percent_val,
            "irUniverse": _or(copied.get("irUniverse"), target_demographic),
            "quotas": _or(copied.get("quotas"), "None"),
            "waves": _or(copied.get("waves"), 1),
            "totalFreshSample": target_size,
            "totalSampleSize": target_size,
            "internal": internal_cap,
            "maxInternalPercent": 100,
            "vendor1": target_size,
            "vendor1Cpi": _or(copied.get("vendor1Cpi"), 3),
            "vendor2": math.floor(target_size / 2 + 0.5),
            "vendor2Cpi": _or(copied.get("vendor2Cpi"), 5),
            "vendor3": 0,
            "vendor3Cpi": 0,
            "vendor4": 0,
            "vendor4Cpi": 0,
            "vendor1Pct": _coalesce(copied.get("vendor1Pct"), 100),
            "vendor2Pct": _coalesce(copied.get("vendor2Pct"), 100),
            "vendor3Pct": _coalesce(copied.get("vendor3Pct"), 100),
            "vendor4Pct": _coalesce(copied.get("vendor4Pct"), 100),
            "pmFee": _or(copied.get("pmFee"), 100),
            "salesCpi": _or(copied.get("salesCpi"), 6),
            "comparability": "High",
        }

        pitches_map[new_id] = new_row
        has_modifications = True

        text = (
            f"### 📁 What Was Checked\n\n"
            f"* Received request to mount a new market study line item.\n\n"
            f"* Parameters parsed: Market: **{market}**, Target: **{_fmt(target_size)}n**, "
            f"Demographic: **{target_demographic}**, LOI: **{_fmt(loi_val)} mins**, IR: **{ir_percent_val * 100:.0f}%**.\n\n\n"
            f"### 💡 Solution & Allocation Analytics\n\n"
            f"* **New Row Mounted Successfully**:\n"
            f"  - Option Number: **{option_num}**\n"
            f"  - Assigned Internal panel pool: **{_fmt(internal_cap)}** completes potential.\n\n"
            f"* The row has been added across the main dashboard, specs scenarios, and database grids!"
        )

    # 3. DELETE ROW
    elif "delete" in query or "remove line" in query or "remove row" in query:
        match_row = _search(r"row-\w+-\d+", last_msg) or _search(r"row-ai-\w+-\d+", last_msg)
        deleted_id = ""
        if match_row and match_row.group(0) in pitches_map:
            deleted_id = match_row.group(0)
            del pitches_map[deleted_id]
            has_modifications = True
        elif original_pitches:
            deleted_id = original_pitches[-1].get("id")
            pitches_map.pop(deleted_id, None)
            has_modifications = True

        text = (
            f"### 📁 What Was Checked\n\n"
            f"* Request received to remove option row **{deleted_id or 'latest row'}**.\n\n\n"
            f"### 💡 Solution & Allocation Analytics\n\n"
            f"* **Action Completed**: Removed specification row from active scenario list. "
            f"The table view and calculations updated instantly."
        )

    # 4. DEFICIT / SHORTAGE AUDIT
    elif "deficit" in query or "unsatisfied" in query or "shortage" in query:
        deficits = []
        for p in original_pitches:
            total_pool = sum(
                _num(p.get(k)) or 0 for k in ("internal", "vendor1", "vendor2", "vendor3", "vendor4")
            )
            target = _coalesce(_num(p.get("totalSampleSize")), 1000)
            if total_pool < target:
                deficits.append(
                    f"**{p.get('market')}** (Option {p.get('option')}): target {_fmt(target)} vs available "
                    f"capacity {_fmt(total_pool)} (Shortage: **{_fmt(target - total_pool)} completes**)"
                )

        if deficits:
            deficit_lines = "\n\n".join(f"* {d}" for d in deficits)
            text = (
                f"### 📁 What Was Checked\n\n"
                f"* Audited internal feasibility capacity and general vendor pools against Target sizes "
                f"across **{len(original_pitches)} scenarios**.\n\n\n"
                f"### 💡 Solution & Allocation Analytics\n\n"
                f"* Found **{len(deficits)}** options showing completes deficits under current max capacity pools:\n\n"
                f"{deficit_lines}\n\n"
                f"* **Feasibility Suggestion**: Negotiate higher caps with Vendor 1 or raise the max allowed "
                f"internal panel utilization percentage!"
            )
        else:
            text = (
                "### 📁 What Was Checked\n\n"
                "* Audited active scenario list against total feasibility pools (Internal + all 4 Vendor tiers).\n\n\n"
                "### 💡 Solution & Allocation Analytics\n\n"
                "* **Status**: **Perfect feasibility!** All active target sizes can be 100% satisfied with active "
                "panels and vendor pools. No completes shortages detected."
            )

    # 5. CHEAPEST VENDOR / SOURCE / RATES
    elif any(k in query for k in ("cheapest source", "cheapest vendor", "lowest cpi", "best rate")):
        # Unreachable in practice ("cheapest" is caught by rule 1), kept to mirror the original engine.
        best_vendor = "Vendor 1"
        min_cpi = 999
        for p in original_pitches:
            for i in range(1, 5):
                cpi = _num(p.get(f"vendor{i}Cpi"))
                if cpi is not None and 0 < cpi < min_cpi:
                    min_cpi = cpi
                    best_vendor = f"Vendor {i}"

        text = (
            f"### 📁 What Was Checked\n\n"
            f"* Audited external vendor matrices across active markets to locate the lowest unit CPI procurement costs.\n\n\n"
            f"### 💡 Solution & Allocation Analytics\n\n"
            f"* **Cheapest Source**: **{best_vendor}** has unit rates starting at **${min_cpi:.2f}**.\n\n"
            f"* **Operations Suggestion**: Ensure calculation strategy is set to **\"cost\"** to automatically "
            f"prioritize routing completes to this vendor first."
        )

    # 6. DATABASE LOOKUP
    elif "database" in query or "lookup" in query or "inserted" in query:
        db = data_state.get("insertedDatabase") or []
        if not db:
            text = (
                "### 📁 What Was Checked\n\n"
                "* Checked the capability lookup database storage.\n\n\n"
                "### 💡 Solution & Allocation Analytics\n\n"
                "* **Status**: No external database file currently mounted. You can upload one via the "
                "**\"Insert Database\"** button in the top navigation bar or the Manage Scenario Specifications tab!"
            )
        else:
            markets = list(dict.fromkeys(r.get("market") or r.get("Country") or "Unknown" for r in db))[:8]
            ellipsis = "..." if len(markets) < len(db) else ""
            text = (
                f"### 📁 What Was Checked\n\n"
                f"* Queried the local lookup capability database.\n\n\n"
                f"### 💡 Solution & Allocation Analytics\n\n"
                f"* **Total Records Loaded**: **{len(db)}** rows\n"
                f"* **Sample Markets**: {', '.join(str(m) for m in markets)}{ellipsis}\n\n"
                f"* You can cross-reference records or run checks against these targets at any time."
            )

    # 7. GENERAL ASSISTANCE & STATUS
    else:
        db_count = len(data_state.get("insertedDatabase") or [])
        text = (
            f"### 📁 What Was Checked\n\n"
            f"* Analyzed active feasibility workspace containing **{len(original_pitches)} target country groups** "
            f"and your procurement rules metadata.\n\n\n"
            f"### 💡 Solution & Allocation Analytics\n\n"
            f"* **Study Details**:\n"
            f"  - Number of Active Markets: **{len(original_pitches)}**\n"
            f"  - Active Allocation Strategy: **\"{(active_strategy or 'cost').upper()}\"**\n"
            f"  - Database Records Mounted: **{db_count}**\n"
            f"  - Engine Mode: **Local Rule-Based (Deterministic / No AI)**\n\n"
            f"* I can execute commands such as:\n"
            f"  * **\"create the cheapest version\"**\n"
            f"  * **\"add a new line for [Country]\"**\n"
            f"  * **\"check deficits\"**\n"
            f"  * **\"cheapest source\"**\n\n"
            f"How would you like to adjust feasibility specifications today?"
        )

    result = {
        "text": text,
        "updatedPitches": list(pitches_map.values()) if has_modifications else None,
    }
    if update_strategy:
        result["updateStrategy"] = update_strategy
    return result
