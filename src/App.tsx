import { createContext, useContext, useEffect, useState } from "react";
import { ClipboardCheck, Gauge, ListChecks, PenLine, ScanLine } from "lucide-react";
import { CYCLE, VARIANCES, checks } from "./data/repository";
import type { SiteCode } from "./data/types";
import { useWho } from "./PowerProvider";
import CountHome from "./screens/CountHome";
import SiteView from "./screens/SiteView";
import ZoneView from "./screens/ZoneView";
import CountLine from "./screens/CountLine";
import Review from "./screens/Review";
import LiveBoard from "./screens/LiveBoard";
import Checks from "./screens/Checks";
import SignOff from "./screens/SignOff";

export type Tab = "count" | "review" | "live" | "checks" | "signoff";
export type Route =
  | { tab: "count"; view: "home" }
  | { tab: "count"; view: "site"; site: SiteCode }
  | { tab: "count"; view: "zone"; zone: string }
  | { tab: "count"; view: "line"; zone: string; batch: string; typo?: boolean }
  | { tab: Exclude<Tab, "count"> };

const Nav = createContext<(r: Route) => void>(() => {});
export const useNav = () => useContext(Nav);

const TABS: { id: Tab; label: string; icon: typeof ScanLine; badge?: () => number }[] = [
  { id: "count", label: "Count", icon: ScanLine },
  { id: "review", label: "Review", icon: ClipboardCheck, badge: () => VARIANCES.filter((v) => v.state === "open").length },
  { id: "live", label: "Live", icon: Gauge },
  { id: "checks", label: "Checks", icon: ListChecks, badge: () => checks().filter((c) => c.severity === "high").length },
  { id: "signoff", label: "Sign-off", icon: PenLine },
];

function fromHash(): Route {
  const h = location.hash.replace("#", "") as Tab;
  if (h === "count" || !TABS.some((t) => t.id === h)) return { tab: "count", view: "home" };
  return { tab: h } as Route;
}

export default function App() {
  const [route, setRoute] = useState<Route>(fromHash);
  const who = useWho();

  const go = (r: Route) => {
    setRoute(r);
    try {
      history.replaceState(null, "", "#" + r.tab);
    } catch {
      /* preview frames may refuse history changes */
    }
    document.getElementById("main")?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const on = () => setRoute(fromHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  let screen;
  if (route.tab === "count") {
    if (route.view === "home") screen = <CountHome />;
    else if (route.view === "site") screen = <SiteView code={route.site} />;
    else if (route.view === "zone") screen = <ZoneView zone={route.zone} />;
    else screen = <CountLine zone={route.zone} batch={route.batch} typo={route.typo} />;
  } else if (route.tab === "review") screen = <Review />;
  else if (route.tab === "live") screen = <LiveBoard />;
  else if (route.tab === "checks") screen = <Checks />;
  else screen = <SignOff />;

  return (
    <Nav.Provider value={go}>
      <div className="shell">
        <div className="brand-bar" aria-hidden="true" />
        <aside className="rail" aria-label="Main">
          <div className="brand">
            <BagMark />
            <div>
              <div className="brand-name">Stock Take</div>
              <div className="brand-sub">Ibero Kenya</div>
            </div>
          </div>
          <div className="cycle">
            <div className="cycle-name">{CYCLE.name}</div>
            <div className="cycle-meta">
              {CYCLE.countDate}, {CYCLE.now}
            </div>
            <div className="live-dot">Count in progress</div>
          </div>
          <nav className="tabs">
            {TABS.map((t) => {
              const n = t.badge?.() ?? 0;
              return (
                <button
                  key={t.id}
                  className="tab"
                  aria-current={route.tab === t.id ? "page" : undefined}
                  onClick={() => go(t.id === "count" ? { tab: "count", view: "home" } : ({ tab: t.id } as Route))}
                >
                  <t.icon size={20} strokeWidth={1.8} aria-hidden />
                  <span>{t.label}</span>
                  {n > 0 && <span className="badge">{n}</span>}
                </button>
              );
            })}
          </nav>
          <div className="me">
            <span className="avatar" aria-hidden>
              {who.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
            </span>
            <div>
              <div className="me-name">{who.name}</div>
              <div className="me-role">Counter · Ibero, rows D–E</div>
            </div>
          </div>
        </aside>
        <main id="main" className="main">
          <div className="demo-note" role="note">
            Design preview. Buttons and inputs respond, but nothing is saved. Stock figures are from the {CYCLE.snapshot}.
          </div>
          {screen}
        </main>
      </div>
    </Nav.Provider>
  );
}

/** A stacked-bag mark: three jute bags in a tier. */
function BagMark() {
  return (
    <svg className="mark" viewBox="0 0 40 40" aria-hidden>
      <rect x="4" y="21" width="14" height="13" rx="4" fill="var(--jute)" />
      <rect x="22" y="21" width="14" height="13" rx="4" fill="var(--jute)" />
      <rect x="13" y="7" width="14" height="13" rx="4" fill="var(--green)" />
      <path d="M8 24h6M26 24h6M17 10h6" stroke="var(--surface)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
