import React, { useEffect, useState } from "react";
import LedgerView from "./LedgerView";
import BeginningInventoryForm from "./BeginningInventoryForm";
import MovementLogForm from "./MovementLogForm";
import RemainingCountForm from "./RemainingCountForm";
import LedgerHistory from "./LedgerHistory";
import { monthKey, shiftMonthKey } from "../../utils/ledger";
import type {
  ChamsBeginning,
  ChamsBranch,
  ChamsCount,
  ChamsMovement,
  ChamsProduct,
} from "../../types/domain";

const INITIAL_BRANCHES: ChamsBranch[] = [
  { id: "BR-01", name: "Chams Poblacion" },
  { id: "BR-02", name: "Chams Lahug" },
  { id: "BR-03", name: "Chams Mandaue" },
];

// FR-3.9.6: sellingPrice is the standardized price used for profit = sold x price.
const SIOPAO_PRODUCTS: ChamsProduct[] = [
  { id: "PORK", name: "Pork Siopao", sellingPrice: 25 },
  { id: "BEEF", name: "Beef Siopao", sellingPrice: 28 },
  { id: "CHOCO", name: "Choco Siopao", sellingPrice: 22 },
];

const CURRENT_MONTH = monthKey();
const MONTH_MINUS_1 = shiftMonthKey(CURRENT_MONTH, -1);
const MONTH_MINUS_2 = shiftMonthKey(CURRENT_MONTH, -2);

// Rough per-branch and per-product volume multipliers used only to seed
// plausible demo data — not part of the ledger's actual math.
const BRANCH_FACTOR: Record<string, number> = { "BR-01": 1, "BR-02": 0.7, "BR-03": 0.5 };
const PRODUCT_BASE: Record<string, number> = { PORK: 90, BEEF: 70, CHOCO: 60 };

function buildSeedData(): {
  beginnings: ChamsBeginning[];
  movements: ChamsMovement[];
  counts: ChamsCount[];
} {
  const beginnings: ChamsBeginning[] = [];
  const movements: ChamsMovement[] = [];
  const counts: ChamsCount[] = [];
  let beginningSeq = 0;
  let movementSeq = 0;
  let countSeq = 0;

  INITIAL_BRANCHES.forEach((branch) => {
    SIOPAO_PRODUCTS.forEach((product) => {
      const factor = BRANCH_FACTOR[branch.id];
      const baseStock = Math.round(PRODUCT_BASE[product.id] * factor);

      // Only the earliest month gets a true, explicit onboarding beginning.
      // Every month's restocked total = last month's remaining, carried
      // over automatically (FR-3.9.4), plus whatever the supplier manually
      // restocks that month (FR-3.9.5).
      const openingCount = Math.round(baseStock * 0.15);
      beginningSeq += 1;
      beginnings.push({
        id: `BG-${String(beginningSeq).padStart(4, "0")}`,
        branchId: branch.id,
        productId: product.id,
        month: MONTH_MINUS_2,
        openingCount,
      });

      let carryOver = 0;
      let remaining: number | null = null;
      [MONTH_MINUS_2, MONTH_MINUS_1].forEach((month, idx) => {
        const beginning = month === MONTH_MINUS_2 ? openingCount : 0;
        const manualRestocked = Math.round(baseStock * (idx === 0 ? 0.85 : 0.6));
        const available = beginning + carryOver + manualRestocked;
        const spoilage = Math.round(available * 0.05);
        const sold = Math.round(available * 0.55);
        movementSeq += 1;
        movements.push({
          id: `MV-${String(movementSeq).padStart(4, "0")}`,
          branchId: branch.id,
          productId: product.id,
          month,
          restocked: manualRestocked,
          spoilage,
          sold,
        });
        remaining = available - spoilage - sold;
        carryOver = remaining;

        countSeq += 1;
        counts.push({
          id: `CT-${String(countSeq).padStart(4, "0")}`,
          branchId: branch.id,
          productId: product.id,
          month,
          remainingReported: remaining as number,
        });
      });

      // Current month: partially logged, nothing counted yet — demonstrates
      // the in-progress state. Carryover still applies automatically even
      // for the one combo left without a movement entry.
      const skipCurrentMovement = branch.id === "BR-03" && product.id === "CHOCO";
      if (!skipCurrentMovement) {
        const manualRestocked = Math.round(baseStock * 0.6);
        const currentAvailable = carryOver + manualRestocked;
        const spoilage = Math.round(currentAvailable * 0.03);
        const sold = Math.round(currentAvailable * 0.3);
        movementSeq += 1;
        movements.push({
          id: `MV-${String(movementSeq).padStart(4, "0")}`,
          branchId: branch.id,
          productId: product.id,
          month: CURRENT_MONTH,
          restocked: manualRestocked,
          spoilage,
          sold,
        });
      }
    });
  });

  // Deliberate demo discrepancy: Chams Poblacion's Pork Siopao count for last
  // month was reported short by 4 versus the calculated remaining.
  const flaggedCount = counts.find(
    (c) => c.branchId === "BR-01" && c.productId === "PORK" && c.month === MONTH_MINUS_1
  );
  if (flaggedCount) flaggedCount.remainingReported -= 4;

  return { beginnings, movements, counts };
}

const NAV_ITEMS: Array<{ key: ChamsTabId; label: string; path: string }> = [
  {
    key: "ledger",
    label: "Ledger",
    path: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2",
  },
  {
    key: "beginning",
    label: "Beginning Inventory",
    path: "M12 4.5v15m7.5-7.5h-15",
  },
  {
    key: "movement-entry",
    label: "Spoilage / Sold Logging",
    path: "M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z",
  },
  {
    key: "count-entry",
    label: "Remaining Count Entry",
    path: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  },
  {
    key: "history",
    label: "Ledger History",
    path: "M3 3v18h18M7 15l4-4 4 4 5-6",
  },
];

type ChamsTabId = "ledger" | "beginning" | "movement-entry" | "count-entry" | "history";

interface ChamsStockLedgerProps {
  onSwitchView: () => void;
}

export default function ChamsStockLedger({ onSwitchView }: ChamsStockLedgerProps) {
  const [activeChamsTab, setActiveChamsTab] = useState<ChamsTabId>("ledger");
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isTabletSidebarOpen, setIsTabletSidebarOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [month, setMonth] = useState(CURRENT_MONTH);
  const [branches] = useState(INITIAL_BRANCHES);
  const [products] = useState(SIOPAO_PRODUCTS);
  const [seed] = useState(buildSeedData);
  const [beginnings, setBeginnings] = useState(seed.beginnings);
  const [movements, setMovements] = useState(seed.movements);
  const [counts, setCounts] = useState(seed.counts);

  // "Tablet" = md..lg range (768px - 1023px). Touch can't hover, so the rail
  // expands/collapses on click; labels stay visible while it is expanded.
  const isTablet = windowWidth >= 768 && windowWidth < 1024;
  const sidebarExpanded = isTablet && isTabletSidebarOpen;
  const sidebarLabelCls = sidebarExpanded
    ? "opacity-100"
    : "opacity-100 md:opacity-0 lg:group-hover:opacity-100";

  const handleNavClick = (tab: ChamsTabId) => {
    setActiveChamsTab(tab);
    setIsMobileOpen(false);
    setIsTabletSidebarOpen(false);
  };

  const upsertBeginning = (data: Omit<ChamsBeginning, "id">) => {
    setBeginnings((prev) => {
      const idx = prev.findIndex(
        (b) => b.branchId === data.branchId && b.productId === data.productId && b.month === data.month
      );
      if (idx === -1) return [...prev, { id: `BG-${String(prev.length + 1).padStart(4, "0")}`, ...data }];
      const next = [...prev];
      next[idx] = { ...next[idx], ...data };
      return next;
    });
  };

  const upsertMovement = (data: Omit<ChamsMovement, "id">) => {
    setMovements((prev) => {
      const idx = prev.findIndex(
        (m) => m.branchId === data.branchId && m.productId === data.productId && m.month === data.month
      );
      if (idx === -1) return [...prev, { id: `MV-${String(prev.length + 1).padStart(4, "0")}`, ...data }];
      const next = [...prev];
      next[idx] = { ...next[idx], ...data };
      return next;
    });
  };

  const upsertCount = (data: Omit<ChamsCount, "id">) => {
    setCounts((prev) => {
      const idx = prev.findIndex(
        (c) => c.branchId === data.branchId && c.productId === data.productId && c.month === data.month
      );
      if (idx === -1) return [...prev, { id: `CT-${String(prev.length + 1).padStart(4, "0")}`, ...data }];
      const next = [...prev];
      next[idx] = { ...next[idx], ...data };
      return next;
    });
  };

  return (
    <>
      {/* MOBILE TOP BAR */}
      <div className="md:hidden bg-[#1B2A4A] text-[#EAF0FB] p-4 flex justify-between items-center shadow-md z-30 w-full">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="p-2 focus:outline-none bg-[#3B5BA5]/20 rounded-md"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <button onClick={onSwitchView} className="flex items-center" title="Switch to Reid's Bakery HQ">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center mr-2 p-1">
            <span className="text-[#1B2A4A] font-bold text-xs">CH</span>
          </div>
          <h1 className="text-lg font-bold">Chams Ledger</h1>
        </button>
      </div>

      {/* MOBILE OVERLAY */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* TABLET SIDEBAR BACKDROP — click outside the expanded rail to close it */}
      {sidebarExpanded && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setIsTabletSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        onClick={(e) => {
          if (!isTablet) return;
          // When expanded, only bare spots toggle the rail — button taps keep working
          if (sidebarExpanded && (e.target as HTMLElement).closest("button")) return;
          setIsTabletSidebarOpen((prev) => !prev);
        }}
        className={`
        fixed md:relative inset-y-0 left-0 z-50
        transform ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0
        w-72 ${sidebarExpanded ? "md:w-72" : "md:w-20"} lg:hover:w-72
        transition-all duration-300 ease-in-out
        bg-[#1B2A4A] text-[#EAF0FB] flex flex-col shadow-2xl group
      `}
      >
        <div className="p-5 border-b border-[#3B5BA5]/20 flex justify-between items-center whitespace-nowrap md:h-[76px]">
          <button onClick={onSwitchView} className="flex items-center" title="Switch to Reid's Bakery HQ">
            <div className="w-10 h-10 bg-white rounded-full flex flex-shrink-0 items-center justify-center mr-4 p-1 shadow-inner">
              <span className="text-[#1B2A4A] font-bold text-xs text-center leading-tight">
                CH
                <br />
                <span className="text-[6px]">CHAMS</span>
              </span>
            </div>
            <span
              className={`text-xl font-bold truncate ${sidebarLabelCls} transition-opacity duration-300 ease-in-out`}
            >
              Chams Ledger
            </span>
          </button>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="md:hidden p-1 text-[#EAF0FB]/60 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-3 mt-4 overflow-y-auto hide-scrollbar">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => handleNavClick(item.key)}
              className={`w-full flex items-center p-3 rounded-lg font-bold transition-colors whitespace-nowrap overflow-hidden ${
                activeChamsTab === item.key
                  ? "bg-[#3B5BA5]/20 text-white shadow-md border-l-4 border-[#5B84D6]"
                  : "text-[#EAF0FB]/60 hover:bg-[#3B5BA5]/10 hover:text-white border-l-4 border-transparent"
              }`}
            >
              <div className="flex items-center justify-center w-8 flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.path} />
                </svg>
              </div>
              <span
                className={`ml-3 truncate ${sidebarLabelCls} transition-opacity duration-300 text-left`}
              >
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-[#3B5BA5]/20">
          <button
            onClick={onSwitchView}
            className="w-full flex items-center p-3 rounded-lg font-bold text-[#EAF0FB]/60 hover:bg-[#3B5BA5]/10 hover:text-white transition-colors whitespace-nowrap overflow-hidden"
          >
            <div className="flex items-center justify-center w-8 flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </div>
            <span className={`ml-3 truncate ${sidebarLabelCls} transition-opacity duration-300`}>
              Back to Bakery HQ
            </span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 relative z-10 w-full flex flex-col p-4 md:p-8 overflow-y-auto">
        {activeChamsTab === "ledger" && (
          <LedgerView
            branches={branches}
            products={products}
            beginnings={beginnings}
            movements={movements}
            counts={counts}
            month={month}
            onMonthChange={setMonth}
          />
        )}
        {activeChamsTab === "beginning" && (
          <BeginningInventoryForm
            branches={branches}
            products={products}
            beginnings={beginnings}
            onSubmit={upsertBeginning}
          />
        )}
        {activeChamsTab === "movement-entry" && (
          <MovementLogForm branches={branches} products={products} movements={movements} onSubmit={upsertMovement} />
        )}
        {activeChamsTab === "count-entry" && (
          <RemainingCountForm branches={branches} products={products} counts={counts} onSubmit={upsertCount} />
        )}
        {activeChamsTab === "history" && (
          <LedgerHistory
            branches={branches}
            products={products}
            beginnings={beginnings}
            movements={movements}
            counts={counts}
          />
        )}
      </main>
    </>
  );
}
