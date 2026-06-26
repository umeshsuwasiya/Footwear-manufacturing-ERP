import { useEffect, useState } from "react";
import { http } from "../lib/api";
import { PageHeader, Card, BtnPrimary, BtnSecondary } from "../components/ui-kit";
import { Clock, RotateCcw, Save, Check } from "lucide-react";

const STAGE_LABEL = {
  procurement: "Procurement",
  cutting: "Cutting",
  folding: "Folding",
  attachment: "Attachment",
  stitching: "Stitching",
  lasting: "Lasting",
  sole_pasting: "Sole Pasting",
  finishing: "Finish / QC / Pack",
};

const STAGE_ORDER = ["procurement", "cutting", "folding", "attachment", "stitching", "lasting", "sole_pasting", "finishing"];

export default function Settings() {
  const [hours, setHours] = useState({});
  const [defaults, setDefaults] = useState({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await http.get("/settings/stage-durations");
    setHours(data.hours || {});
    setDefaults(data.defaults || {});
  };
  useEffect(() => { load(); }, []);

  const setStage = (k, v) => setHours(h => ({ ...h, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = { hours: {} };
      STAGE_ORDER.forEach(k => { payload.hours[k] = Number(hours[k] || 0); });
      await http.put("/settings/stage-durations", payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { alert(e.response?.data?.detail || e.message); }
    finally { setSaving(false); }
  };

  const resetToDefault = () => setHours({ ...defaults });

  const totalHours = STAGE_ORDER.reduce((s, k) => s + Number(hours[k] || 0), 0);

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="System / ETA Configuration"
        testId="settings-header"
        action={
          <div className="flex gap-2">
            <BtnSecondary onClick={resetToDefault} data-testid="reset-defaults-btn">
              <RotateCcw className="w-3.5 h-3.5 inline -mt-0.5 mr-1" /> Reset to default
            </BtnSecondary>
            <BtnPrimary onClick={save} disabled={saving} data-testid="save-settings-btn"
              className="bg-[#16A34A] border-[#16A34A] hover:bg-[#0F7A36]">
              {saved ? <><Check className="w-3.5 h-3.5 inline -mt-0.5 mr-1" /> Saved</> : <><Save className="w-3.5 h-3.5 inline -mt-0.5 mr-1" /> {saving ? "Saving..." : "Save"}</>}
            </BtnPrimary>
          </div>
        }
      />
      <div className="p-8 space-y-6 max-w-4xl">
        <Card className="p-6">
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#C27842]" /> Stage ETA / Deadline (hours)
            </h2>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
              Total ETA: <span className="font-mono text-slate-900">{totalHours} hrs ≈ {(totalHours / 24).toFixed(1)} days</span>
            </div>
          </div>
          <p className="text-xs text-slate-600 mb-5">
            Maximum allowed time for a job to remain in each production stage. Once a stage is exceeded, the job appears in the <b>Overdue</b> alert on the Dashboard and is highlighted on the Production floor.
          </p>

          <div className="space-y-2" data-testid="stage-duration-list">
            {STAGE_ORDER.map((k) => (
              <div key={k} className="flex items-center gap-4 border-2 border-slate-200 px-4 py-3 hover:border-[#C27842] transition-colors">
                <div className="w-44 font-bold uppercase tracking-wider text-sm">{STAGE_LABEL[k]}</div>
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="number" min="0" step="1"
                    value={hours[k] ?? ""}
                    onChange={(e) => setStage(k, e.target.value)}
                    data-testid={`duration-input-${k}`}
                    className="w-28 border-2 border-slate-300 px-3 py-2 font-mono text-lg focus:border-[#C27842] focus:outline-none"
                  />
                  <span className="text-xs uppercase tracking-wider font-bold text-slate-500">hours</span>
                  <span className="text-xs text-slate-500 ml-2">≈ {(Number(hours[k] || 0) / 24).toFixed(1)} days</span>
                </div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  Default: <span className="font-mono font-bold">{defaults[k]}h</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 bg-orange-50 border-orange-200">
          <div className="text-xs text-slate-700 leading-relaxed">
            <b className="text-[#C27842]">How this works:</b> Whenever a production job moves to a new stage, the system records the entry time and computes a deadline as <i>entry + stage hours</i>. If the deadline passes without the job moving forward, it appears in the <b>Overdue</b> widget on the Dashboard and the Production board card turns red with an alert badge. Existing jobs use these settings on their next stage transition.
          </div>
        </Card>
      </div>
    </div>
  );
}
