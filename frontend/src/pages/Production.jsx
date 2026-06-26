import { useEffect, useMemo, useState } from "react";
import { http } from "../lib/api";
import { PageHeader, Card, Badge } from "../components/ui-kit";
import { useAuth } from "../lib/auth";

const STAGES = [
  { key: "procurement", label: "Procurement", color: "#64748B" },
  { key: "cutting", label: "Cutting", color: "#2563EB" },
  { key: "folding", label: "Folding", color: "#0284C7" },
  { key: "attachment", label: "Attachment", color: "#7C3AED" },
  { key: "stitching", label: "Stitching", color: "#C27842" },
  { key: "lasting", label: "Lasting", color: "#A65D24" },
  { key: "sole_pasting", label: "Sole Pasting", color: "#F59E0B" },
  { key: "finishing", label: "Finish / QC / Pack", color: "#16A34A" },
  { key: "dispatched", label: "Dispatched", color: "#F97316" },
];

const sortSizes = (a, b) => {
  const na = parseFloat(a), nb = parseFloat(b);
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  return String(a).localeCompare(String(b));
};

/** Group jobs (already filtered by stage) by `po_number + style_code` into matrix-ready bundles. */
function groupJobs(jobs) {
  const groups = {};
  for (const j of jobs) {
    const key = `${j.po_number}::${j.style_code}`;
    if (!groups[key]) {
      groups[key] = {
        key,
        po_number: j.po_number,
        po_id: j.po_id,
        style_code: j.style_code,
        client_name: j.client_name,
        description: j.description,
        delivery_date: j.delivery_date,
        rows: [], // each = job
        colors: new Set(),
        sizes: new Set(),
      };
    }
    groups[key].rows.push(j);
    groups[key].colors.add(j.color || "—");
    groups[key].sizes.add(String(j.size || "—"));
  }
  return Object.values(groups).map(g => ({
    ...g,
    colors: Array.from(g.colors).sort(),
    sizes: Array.from(g.sizes).sort(sortSizes),
    totalQty: g.rows.reduce((s, r) => s + (r.quantity || 0), 0),
  }));
}

export default function Production() {
  const [jobs, setJobs] = useState([]);
  const { user } = useAuth();
  const canEdit = ["admin", "manager", "production"].includes(user?.role);

  const load = async () => {
    const { data } = await http.get("/production/jobs");
    setJobs(data);
  };
  useEffect(() => { load(); }, []);

  const moveGroup = async (group, nextStage) => {
    await Promise.all(group.rows.map(j =>
      http.patch(`/production/jobs/${j.id}`, { stage: nextStage })
    ));
    load();
  };

  return (
    <div>
      <PageHeader title="Production Floor" subtitle="Manufacturing / Kanban" testId="production-header" />

      <div className="p-8">
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {STAGES.map((s) => {
              const stageJobs = jobs.filter((j) => j.stage === s.key);
              const groups = groupJobs(stageJobs);
              const totalQty = stageJobs.reduce((sum, j) => sum + j.quantity, 0);
              return (
                <div key={s.key} className="w-[420px] flex-shrink-0" data-testid={`column-${s.key}`}>
                  <div className="bg-white border-2 border-slate-200 border-t-4 mb-3 p-3" style={{ borderTopColor: s.color }}>
                    <div className="flex items-baseline justify-between">
                      <div className="font-bold uppercase tracking-wider text-sm">{s.label}</div>
                      <div className="font-mono text-xs text-slate-500">
                        {groups.length} {groups.length === 1 ? "style" : "styles"} · <span className="font-bold text-slate-900">{totalQty}</span> pairs
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {groups.length === 0 && (
                      <div className="border-2 border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">Empty</div>
                    )}
                    {groups.map((g) => (
                      <StyleGroupCard
                        key={g.key}
                        group={g}
                        stageColor={s.color}
                        stageIdx={STAGES.findIndex(x => x.key === s.key)}
                        canEdit={canEdit}
                        onMove={moveGroup}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {jobs.length === 0 && (
          <Card className="p-12 text-center text-slate-400 mt-4">
            No production jobs yet. Create a Purchase Order — jobs are auto-generated per line item.
          </Card>
        )}
      </div>
    </div>
  );
}

function StyleGroupCard({ group, stageColor, stageIdx, canEdit, onMove }) {
  const nextStage = STAGES[stageIdx + 1];
  const prevStage = STAGES[stageIdx - 1];

  // Build matrix: colors × sizes
  const matrix = useMemo(() => {
    const m = {};
    for (const c of group.colors) m[c] = {};
    for (const r of group.rows) {
      const c = r.color || "—";
      const sz = String(r.size || "—");
      m[c][sz] = (m[c][sz] || 0) + (r.quantity || 0);
    }
    return m;
  }, [group]);

  const sizeTotals = useMemo(() => {
    const t = {};
    for (const sz of group.sizes) {
      t[sz] = group.colors.reduce((s, c) => s + (matrix[c][sz] || 0), 0);
    }
    return t;
  }, [group, matrix]);

  return (
    <Card className="border-l-4 hover:border-[#C27842] transition-colors" style={{ borderLeftColor: stageColor }} data-testid={`group-${group.key}`}>
      <div className="p-3 pb-2 border-b border-slate-100">
        <div className="flex items-baseline justify-between mb-0.5">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{group.po_number}</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">{group.client_name}</div>
        </div>
        <div className="font-mono font-bold text-sm">{group.style_code}</div>
        {group.description && <div className="text-xs text-slate-500 line-clamp-1">{group.description}</div>}
      </div>

      <div className="p-3 overflow-x-auto">
        <table className="w-full text-xs border border-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-2 py-1 text-left text-[10px] uppercase tracking-wider font-bold text-slate-600 border-r border-slate-200">Color</th>
              {group.sizes.map(sz => (
                <th key={sz} className="px-2 py-1 text-center font-mono text-[11px] font-bold text-slate-700 border-r border-slate-200 last:border-r-0">{sz}</th>
              ))}
              <th className="px-2 py-1 text-right text-[10px] uppercase tracking-wider font-bold text-slate-900 bg-slate-100">Total</th>
            </tr>
          </thead>
          <tbody>
            {group.colors.map(c => {
              const rowTotal = group.sizes.reduce((s, sz) => s + (matrix[c][sz] || 0), 0);
              return (
                <tr key={c} className="border-t border-slate-200">
                  <td className="px-2 py-1 font-bold text-slate-700 border-r border-slate-200" data-testid={`color-${c}`}>{c}</td>
                  {group.sizes.map(sz => (
                    <td key={sz} className="px-2 py-1 text-center font-mono border-r border-slate-200 last:border-r-0 text-slate-700">{matrix[c][sz] || "·"}</td>
                  ))}
                  <td className="px-2 py-1 text-right font-mono font-bold bg-slate-50">{rowTotal}</td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-slate-300 bg-[#0F172A] text-white">
              <td className="px-2 py-1.5 font-bold uppercase tracking-wider text-[10px] border-r border-slate-700">Total</td>
              {group.sizes.map(sz => (
                <td key={sz} className="px-2 py-1.5 text-center font-mono font-bold text-[#C27842] border-r border-slate-700 last:border-r-0">{sizeTotals[sz]}</td>
              ))}
              <td className="px-2 py-1.5 text-right font-mono font-black text-[#C27842] text-sm">{group.totalQty}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="px-3 pb-3 flex items-center justify-between gap-2">
        {group.delivery_date && <div className="text-[10px] text-slate-500">Deliver: {group.delivery_date}</div>}
        {canEdit && (
          <div className="flex gap-2 ml-auto">
            {prevStage && (
              <button onClick={() => onMove(group, prevStage.key)} className="text-[10px] uppercase tracking-wider font-bold text-slate-500 hover:text-slate-900 border border-slate-300 px-2 py-1" data-testid={`move-prev-${group.key}`}>← {prevStage.label}</button>
            )}
            {nextStage && (
              <button onClick={() => onMove(group, nextStage.key)} className="text-[10px] uppercase tracking-wider font-bold text-white bg-[#0F172A] hover:bg-[#C27842] px-3 py-1" data-testid={`move-next-${group.key}`}>{nextStage.label} →</button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
