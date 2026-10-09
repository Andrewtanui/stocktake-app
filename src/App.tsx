import { createContext, useContext, useState } from "react";
import { ClipboardList, MessageSquareWarning, RotateCcw, ScanLine } from "lucide-react";
import { useStore } from "./data/store";
import type { SiteCode } from "./data/types";
import Home from "./screens/Home";
import SiteView from "./screens/SiteView";
import StackView from "./screens/StackView";
import CountLot from "./screens/CountLot";
import AddLot from "./screens/AddLot";
import OtherStock from "./screens/OtherStock";
import MyCounts from "./screens/MyCounts";
import Recounts from "./screens/Recounts";
import Report from "./screens/Report";
import { Logo } from "./ui/Logo";

export type Tab = "count" | "counts" | "recounts" | "report";
export type Route =
  | { tab: "count"; view: "home" }
  | { tab: "count"; view: "site"; site: SiteCode }
  | { tab: "count"; view: "stack"; site: SiteCode; stack: string }
  | { tab: "count"; view: "lot"; site: SiteCode; stack: string; batch: string; recount?: string }
  | { tab: "count"; view: "add"; site: SiteCode; stack: string }
  | { tab: "count"; view: "other"; site: SiteCode; stack: string }
  | { tab: Exclude<Tab, "count"> };

const Nav = createContext<(r: Route) => void>(() => {});
export const useNav = () => useContext(Nav);

const SCREEN_NAMES: Record<string, string> = {
  home: "Count home",
  site: "Floor map / site",
  stack: "Stack",
  lot: "Count a lot",
  add: "Add a lot",
  other: "Other stock",
  counts: "My counts",
  recounts: "Recounts",
};

export default function App() {
  const store = useStore();
  const [route, setRoute] = useState<Route>({ tab: "count", view: "home" });
  const [lastScreen, setLastScreen] = useState("Count home");

  const go = (r: Route) => {
    if (route.tab !== "report") setLastScreen(SCREEN_NAMES["view" in route ? route.view : route.tab]);
    setRoute(r);
    window.scrollTo({ top: 0 });
  };

  let screen;
  if (route.tab === "count") {
    if (route.view === "home") screen = <Home />;
    else if (route.view === "site") screen = <SiteView code={route.site} />;
    else if (route.view === "stack") screen = <StackView site={route.site} stack={route.stack} />;
    else if (route.view === "lot")
      screen = <CountLot key={route.batch + route.recount} site={route.site} stack={route.stack} batch={route.batch} recount={route.recount} />;
    else if (route.view === "add") screen = <AddLot site={route.site} stack={route.stack} />;
    else screen = <OtherStock site={route.site} stack={route.stack} />;
  } else if (route.tab === "counts") screen = <MyCounts />;
  else if (route.tab === "recounts") screen = <Recounts />;
  else screen = <Report lastScreen={lastScreen} />;

  const recounts = store.recountsOpen().length;
  const tabs = [
    { id: "count" as const, label: "Count", icon: ScanLine, badge: 0 },
    { id: "counts" as const, label: "My counts", icon: ClipboardList, badge: store.pending },
    { id: "recounts" as const, label: "Recounts", icon: RotateCcw, badge: recounts },
    { id: "report" as const, label: "Report", icon: MessageSquareWarning, badge: 0 },
  ];

  return (
    <Nav.Provider value={go}>
      <div className="app">
        <header className="appbar">
          <div className="appbar-inner">
            <Logo sub="Stock Take" />
            <button
              className={"sync" + (store.online ? "" : " sync-off")}
              onClick={() => store.setOnline(!store.online)}
              title="Demo: tap to switch between online and offline"
              aria-label={store.online ? "Online, all counts sent. Tap to simulate offline." : `Offline, ${store.pending} counts saved on this phone`}
            >
              <span className="sync-dot" aria-hidden />
              {store.online ? "Online" : `Offline · ${store.pending}`}
            </button>
          </div>
          <div className="brand-bar" aria-hidden />
        </header>

        <main className="main">{screen}</main>

        {store.toast && (
          <div className="toast" role="status">
            {store.toast}
          </div>
        )}

        <nav className="tabbar" aria-label="Main">
          {tabs.map((t) => (
            <button
              key={t.id}
              className="tab"
              aria-current={route.tab === t.id ? "page" : undefined}
              onClick={() => go(t.id === "count" ? { tab: "count", view: "home" } : { tab: t.id })}
            >
              <span className="tab-icon">
                <t.icon size={22} strokeWidth={2} aria-hidden />
                {t.badge > 0 && <span className="badge">{t.badge}</span>}
              </span>
              <span className="tab-label">{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </Nav.Provider>
  );
}
