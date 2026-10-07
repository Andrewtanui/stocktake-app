import { ChevronRight, MapPinOff, ScanLine } from "lucide-react";
import { useNav } from "../App";
import { CYCLE, SITE_CEILING, coverage, linesAt, linesInZone, parseZone, sum, zoneStatus } from "../data/repository";
import { useWho } from "../PowerProvider";
import { PageHead, Progress, n } from "../ui/kit";

export default function CountHome() {
  const go = useNav();
  const who = useWho();
  const cov = coverage();

  // My area: rows D–E at Ibero.
  const myZones = [...new Set(linesAt("IBR").map((l) => l.z!).filter((z) => /^[DE]-/.test(z)))].sort(
    (a, b) => (parseZone(a)!.bay - parseZone(b)!.bay) || a.localeCompare(b),
  );
  const done = myZones.filter((z) => ["done", "variance"].includes(zoneStatus(z))).length;
  const next = myZones.find((z) => zoneStatus(z) === "active") ?? myZones[0];
  const nextLines = linesInZone(next);

  return (
    <div className="page page-wide">
      <PageHead title={`Morning, ${who.name.split(" ")[0]}`} sub={`${CYCLE.name} · you're counting Ibero rows D and E`} />

      <section className="next-up" aria-labelledby="next-h">
        <div className="next-copy">
          <h2 id="next-h" className="next-label">Next stack</h2>
          <div className="next-zone code">{next}</div>
          <p className="next-meta">
            {nextLines.length} outturns expected · {n(sum(nextLines, (l) => l.u))} units ·{" "}
            {n(sum(nextLines, (l) => l.kg) / 1000, 1)} t
          </p>
          <button className="btn btn-primary btn-lg" onClick={() => go({ tab: "count", view: "zone", zone: next })}>
            <ScanLine size={20} aria-hidden /> Start counting {next}
          </button>
        </div>
        <div className="next-progress">
          <div className="big-fraction">
            <span className="num">{done}</span>
            <span className="of">of {myZones.length} stacks</span>
          </div>
          <Progress value={done} max={myZones.length} />
          <button className="link" onClick={() => go({ tab: "count", view: "site", site: "IBR" })}>
            Open the Ibero floor map
          </button>
        </div>
      </section>

      <section className="block" aria-labelledby="sites-h">
        <div className="block-head">
          <h2 id="sites-h" className="h2">All sites</h2>
          <span className="muted">Bags confirmed so far today</span>
        </div>
        <p className="location-notice">
          <MapPinOff size={16} aria-hidden /> Stack locations are not recorded for five third-party sites.
        </p>
        <ul className="site-list">
          <li className="site-table-head" aria-hidden="true">
            <span>Site</span>
            <span>Type</span>
            <span>Bags confirmed / total</span>
            <span>Lots</span>
            <span>Progress</span>
            <span />
          </li>
          {cov.map(({ site, total, done, lots }) => {
            const located = sum(linesAt(site.code), (l) => (l.z && l.z !== "TEMP-0-0" ? 1 : 0)) > 0;
            const over = site.thirdParty && total > SITE_CEILING;
            return (
              <li key={site.code}>
                <button className="site-row" onClick={() => go({ tab: "count", view: "site", site: site.code })}>
                  <span className="site-name">
                    {site.name}
                    {!located && (
                      <span className="site-location-icon" title="Stack locations not recorded">
                        <MapPinOff size={16} aria-label="Stack locations not recorded" />
                      </span>
                    )}
                    {over && <span className="site-ceiling-flag">{n(total)} bags · over {n(SITE_CEILING)}-bag ceiling</span>}
                  </span>
                  <span className="site-type">{site.thirdParty ? "Third party" : "Own warehouse"}</span>
                  <span className="site-bags">
                    <strong className="num">{n(done)}</strong> / {n(total)}
                  </span>
                  <span className="site-lots num">{n(lots)}</span>
                  <span className="site-progress">
                    <Progress value={done} max={total} tone={done >= total && total ? "ok" : "info"} />
                  </span>
                  <ChevronRight className="chev" size={20} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
