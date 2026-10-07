import { COUNTERS, CYCLE, HOURLY, SITE_CEILING, VARIANCES, coverage, iberoGrid, site } from "../data/repository";
import { Chip, PageHead, Progress, Stat, n } from "../ui/kit";

const NOW_H = 11 + 40 / 60;
const DAY_END = 17;
const TARGET = [6000, 7000];

export default function LiveBoard() {
  const cov = coverage();
  const total = cov.reduce((a, c) => a + c.total, 0);
  const done = cov.reduce((a, c) => a + c.done, 0);
  const cells = iberoGrid().filter((c) => c.zones.length);
  const stacksDone = cells.filter((c) => c.status === "done" || c.status === "variance").length;
  const open = VARIANCES.filter((v) => v.state === "open").length;

  return (
    <div className="page page-wide">
      <PageHead title="Count day, live" sub={`${CYCLE.countDate} · updated ${CYCLE.now} · refreshes as counts are saved`} />

      <div className="stats stats-4">
        <Stat label="Bags confirmed" value={`${Math.round((done / total) * 100)}%`} note={`${n(done)} of ${n(total)}`} />
        <Stat label="Ibero bays finished" value={`${stacksDone} / ${cells.length}`} />
        <Stat label="Counters on site" value={COUNTERS.length} note="across 5 sites" />
        <Stat label="Variances to review" value={open} tone={open ? "warn" : "ok"} note="1 recount out" />
      </div>

      <div className="board">
        <section className="panel" aria-labelledby="hour-h">
          <h2 id="hour-h" className="h3">
            Bags counted per hour
          </h2>
          <HourChart />
        </section>

        <section className="panel" aria-labelledby="site-h">
          <h2 id="site-h" className="h3">
            Coverage by site
          </h2>
          <ul className="cov-list">
            {cov.map(({ site: s, total: t, done: d }) => (
              <li key={s.code}>
                <div className="cov-top">
                  <span>{s.short}</span>
                  <span className="muted">
                    <span className="num">{n(d)}</span> / {n(t)}
                  </span>
                </div>
                <Progress value={d} max={t} tone={t && d >= t ? "ok" : "info"} marker={s.thirdParty && t > SITE_CEILING ? SITE_CEILING : undefined} />
                {s.thirdParty && t > SITE_CEILING && (
                  <div className="small t-crit">
                    {n(t)} bags on one site. The line marks the {n(SITE_CEILING)}-bag count-day ceiling.
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel" aria-labelledby="pace-h">
        <div className="block-head">
          <h2 id="pace-h" className="h3">
            Counter pace
          </h2>
          <span className="muted small">
            Day target {n(TARGET[0])}–{n(TARGET[1])} bags per counter
          </span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Counter</th>
                <th>Where</th>
                <th className="num">Bags so far</th>
                <th className="num">Per hour</th>
                <th>On pace for</th>
                <th className="num hide-sm">Recounts</th>
              </tr>
            </thead>
            <tbody>
              {COUNTERS.map((c) => {
                const rate = c.bagsSoFar / (NOW_H - c.startedAt);
                const proj = c.bagsSoFar + rate * (DAY_END - NOW_H);
                const tone = proj >= TARGET[0] ? "ok" : proj >= TARGET[0] * 0.75 ? "warn" : "crit";
                const siteDone = cov.some((x) => x.site.code === c.site && x.total > 0 && x.done >= x.total);
                return (
                  <tr key={c.name}>
                    <td>{c.name}</td>
                    <td className="muted">
                      {site(c.site).short} · {c.area}
                    </td>
                    <td className="num">{n(c.bagsSoFar)}</td>
                    <td className="num">{n(rate)}</td>
                    <td>
                      {siteDone ? (
                        <Chip tone="ok">Site finished</Chip>
                      ) : (
                      <div className="pace">
                        <div className="pace-track">
                          <div className="pace-band" style={{ left: (TARGET[0] / 9000) * 100 + "%", width: ((TARGET[1] - TARGET[0]) / 9000) * 100 + "%" }} />
                          <div className={`pace-dot fill-${tone}`} style={{ left: Math.min(100, (proj / 9000) * 100) + "%" }} />
                        </div>
                        <span className="num pace-num">{n(Math.round(proj / 10) * 10)}</span>
                      </div>
                      )}
                    </td>
                    <td className="num hide-sm">{c.recounts ? <Chip tone="info">{c.recounts}</Chip> : "0"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small">Sample names. The finished app shows the counters signed in to the count.</p>
      </section>
    </div>
  );
}

function HourChart() {
  const W = 520, H = 220, padL = 44, padB = 28, padT = 12;
  const max = 10000;
  const bw = (W - padL - 10) / HOURLY.length;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bags counted per hour, 07:00 to now">
      <defs>
        <linearGradient id="fresh-gradient" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="var(--brand-fresh-turquoise)" />
          <stop offset="100%" stopColor="var(--brand-fresh-green)" />
        </linearGradient>
      </defs>
      {[0, 2500, 5000, 7500, 10000].map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - 6} y1={y(t)} y2={y(t)} className="grid" />
          <text x={padL - 8} y={y(t) + 4} textAnchor="end" className="axis">
            {t ? `${t / 1000}k` : "0"}
          </text>
        </g>
      ))}
      {HOURLY.map((h, i) => {
        const x = padL + i * bw + 8;
        return (
          <g key={h.h}>
            <rect x={x} y={y(h.bags)} width={bw - 16} height={y(0) - y(h.bags)} rx="3" className={h.partial ? "bar bar-partial" : "bar"} />
            <text x={x + (bw - 16) / 2} y={y(h.bags) - 6} textAnchor="middle" className="bar-label">
              {n(h.bags)}
            </text>
            <text x={x + (bw - 16) / 2} y={H - 8} textAnchor="middle" className="axis">
              {h.h}:00{h.partial ? " so far" : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
