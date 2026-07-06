import { useEffect, useState, useRef } from "react";
import { http, friendlyAxiosError } from "../lib/api";
import { PageHeader, Card, BtnPrimary, BtnSecondary, Input, Select, Badge } from "../components/ui-kit";
import { QRCodeSVG } from "qrcode.react";
import { RefreshCw, Search, ClipboardList, X, Printer, ScanLine, CheckCircle2, Trash2, User } from "lucide-react";

const STATUS_COLORS = {
  pending: "yellow",
  in_progress: "blue",
  completed: "green",
  cancelled: "red",
};

const CHANNEL_COLORS = {
  myntra: "orange",
  flipkart: "blue",
  nykaa: "orange",
  website: "slate",
};

export default function Picklists() {
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState("");
  const [statusFilter, setStatus] = useState("");
  const [channelFilter, setChannel] = useState("");
  const [search, setSearch]     = useState("");
  const [openId, setOpenId]     = useState(null);

  async function load() {
    setLoading(true); setErr("");
    try {
      const q = new URLSearchParams();
      if (statusFilter) q.set("status", statusFilter);
      if (channelFilter) q.set("channel", channelFilter);
      const r = await http.get(`/picklists?${q.toString()}`);
      setRows(r.data);
    } catch (e) {
      setErr(friendlyAxiosError(e));
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [statusFilter, channelFilter]);

  const filtered = search
    ? rows.filter(r => r.picklist_no.toLowerCase().includes(search.toLowerCase()) ||
                       r.order_id.toLowerCase().includes(search.toLowerCase()))
    : rows;

  return (
    <div data-testid="page-picklists">
      <PageHeader
        title="Picklists"
        subtitle="Online Commerce / WMS"
        action={
          <BtnSecondary onClick={load} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 inline mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </BtnSecondary>
        }
      />

      <div className="p-4 sm:p-6">
        {err && <div className="p-3 bg-red-50 border-2 border-red-300 text-red-800 text-sm mb-4">{err}</div>}

        <Card className="p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Input label="Search" placeholder="Picklist no. or Order id…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select label="Status" value={statusFilter} onChange={e => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
            <Select label="Channel" value={channelFilter} onChange={e => setChannel(e.target.value)}>
              <option value="">All channels</option>
              <option value="myntra">Myntra</option>
              <option value="flipkart">Flipkart</option>
              <option value="nykaa">Nykaa</option>
              <option value="website">Website</option>
            </Select>
          </div>
        </Card>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 border-b-2 border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider">Picklist No.</th>
                  <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider">Order ID</th>
                  <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider">Channel</th>
                  <th className="text-right px-4 py-3 font-bold text-[10px] uppercase tracking-wider">Items</th>
                  <th className="text-right px-4 py-3 font-bold text-[10px] uppercase tracking-wider">Qty</th>
                  <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider">Picker</th>
                  <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-500">No picklists match your filters.</td></tr>
                )}
                {filtered.map(r => (
                  <tr key={r.id} onClick={() => setOpenId(r.id)} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" data-testid={`picklist-row-${r.picklist_no}`}>
                    <td className="px-4 py-3 font-mono font-bold">{r.picklist_no}</td>
                    <td className="px-4 py-3">{r.order_id}</td>
                    <td className="px-4 py-3"><Badge color={CHANNEL_COLORS[r.channel] || "slate"}>{r.channel}</Badge></td>
                    <td className="px-4 py-3 text-right">{r.total_items}</td>
                    <td className="px-4 py-3 text-right font-bold">{r.total_qty}</td>
                    <td className="px-4 py-3">{r.picker || <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-3"><Badge color={STATUS_COLORS[r.status] || "slate"}>{r.status.replace("_", " ")}</Badge></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {openId && <PicklistDrawer id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}

function PicklistDrawer({ id, onClose, onChanged }) {
  const [pl, setPl]         = useState(null);
  const [err, setErr]       = useState("");
  const [scan, setScan]     = useState("");
  const [scanIdx, setScanIdx] = useState(null);
  const scanRef = useRef();

  async function load() {
    setErr("");
    try {
      const r = await http.get(`/picklists/${id}`);
      setPl(r.data);
    } catch (e) { setErr(friendlyAxiosError(e)); }
  }
  useEffect(() => { load(); }, [id]);

  async function confirmPick(idx) {
    setErr("");
    if (!scan) return setErr("Please scan/enter the location before confirming.");
    try {
      await http.post(`/picklists/${id}/pick-item`, { item_index: idx, scanned_location: scan });
      setScan(""); setScanIdx(null);
      await load();
      onChanged && onChanged();
    } catch (e) { setErr(friendlyAxiosError(e)); }
  }

  async function del() {
    if (!window.confirm("Delete this picklist and release reservations?")) return;
    try {
      await http.delete(`/picklists/${id}`);
      onChanged && onChanged();
      onClose();
    } catch (e) { setErr(friendlyAxiosError(e)); }
  }

  async function assignPicker(name) {
    try {
      await http.patch(`/picklists/${id}`, { picker: name });
      await load();
    } catch (e) { setErr(friendlyAxiosError(e)); }
  }

  const printSheet = () => window.print();

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-end print:static print:bg-white" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl h-full overflow-auto shadow-2xl print:max-w-none print:shadow-none" onClick={e => e.stopPropagation()}>
        {!pl ? (
          <div className="p-8 text-center text-slate-500">{err || "Loading…"}</div>
        ) : (
          <>
            <div className="px-5 py-4 border-b-2 border-slate-900 flex items-center justify-between print:border-slate-300">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Picklist</div>
                <div className="font-black text-2xl font-mono">{pl.picklist_no}</div>
              </div>
              <div className="flex gap-2 print:hidden">
                <BtnSecondary onClick={printSheet}><Printer className="w-3.5 h-3.5 inline mr-1" />Print</BtnSecondary>
                {pl.status !== "completed" && (
                  <BtnSecondary onClick={del} className="text-red-700 border-red-300 hover:border-red-700"><Trash2 className="w-3.5 h-3.5 inline mr-1" />Cancel</BtnSecondary>
                )}
                <button onClick={onClose} className="text-slate-500 hover:text-slate-900"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {err && <div className="p-3 bg-red-50 border-2 border-red-300 text-red-800 text-sm">{err}</div>}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-500 text-xs uppercase tracking-wider">Order</span><div className="font-bold font-mono">{pl.order_id}</div></div>
                <div><span className="text-slate-500 text-xs uppercase tracking-wider">Channel</span><div><Badge color={CHANNEL_COLORS[pl.channel] || "slate"}>{pl.channel}</Badge></div></div>
                <div><span className="text-slate-500 text-xs uppercase tracking-wider">Status</span><div><Badge color={STATUS_COLORS[pl.status] || "slate"}>{pl.status.replace("_", " ")}</Badge></div></div>
                <div><span className="text-slate-500 text-xs uppercase tracking-wider">Picker</span>
                  <div className="flex gap-2">
                    <input
                      className="border border-slate-300 px-2 py-1 text-sm w-40 font-mono"
                      value={pl.picker || ""}
                      onChange={e => setPl({ ...pl, picker: e.target.value })}
                      onBlur={e => e.target.value !== (pl.picker || "") && assignPicker(e.target.value)}
                      placeholder="Assign picker…"
                      disabled={pl.status === "completed" || pl.status === "cancelled"}
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">
                  Items ({pl.items.length}) — Total {pl.total_qty} pairs
                </div>

                <div className="border border-slate-300">
                  {pl.items.map((it, idx) => {
                    const active = scanIdx === idx;
                    return (
                      <div key={idx} className={`border-b border-slate-200 last:border-b-0 ${it.picked ? "bg-green-50" : ""}`}>
                        <div className="px-4 py-3 flex items-center gap-4">
                          <div className="flex-shrink-0 flex flex-col items-center">
                            <QRCodeSVG value={it.location_code} size={72} />
                            <div className="text-[10px] font-mono font-bold mt-1">{it.location_code}</div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold font-mono">{it.style_code} · {it.color} · Size {it.size}</div>
                            <div className="text-xs text-slate-500 mt-0.5">Rack {it.rack} · Row {it.row} · Col {it.column}</div>
                            <div className="text-2xl font-black mt-1">{it.qty} <span className="text-xs font-normal text-slate-500">pairs</span></div>
                          </div>
                          <div className="flex-shrink-0">
                            {it.picked ? (
                              <Badge color="green"><CheckCircle2 className="w-3 h-3 inline mr-1" />Picked</Badge>
                            ) : (
                              <BtnPrimary onClick={() => { setScanIdx(idx); setScan(""); setTimeout(() => scanRef.current && scanRef.current.focus(), 50); }} className="print:hidden" disabled={pl.status === "cancelled"}>
                                <ScanLine className="w-3.5 h-3.5 inline mr-1" />Pick
                              </BtnPrimary>
                            )}
                          </div>
                        </div>
                        {active && !it.picked && (
                          <div className="px-4 pb-3 pt-1 bg-yellow-50 border-t border-yellow-200 print:hidden">
                            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-600 mb-1">Scan or enter location code</div>
                            <div className="flex gap-2">
                              <input
                                ref={scanRef}
                                value={scan}
                                onChange={e => setScan(e.target.value.toUpperCase())}
                                onKeyDown={e => e.key === "Enter" && confirmPick(idx)}
                                placeholder={`Expected: ${it.location_code}`}
                                className="flex-1 border-2 border-slate-300 px-3 py-2 text-sm font-mono focus:border-[#2563EB] focus:outline-none"
                                data-testid={`scan-input-${idx}`}
                              />
                              <BtnPrimary onClick={() => confirmPick(idx)}>Confirm</BtnPrimary>
                              <BtnSecondary onClick={() => { setScanIdx(null); setScan(""); }}>Cancel</BtnSecondary>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {pl.status === "completed" && (
                <div className="text-xs text-slate-500">Completed at {new Date(pl.completed_at).toLocaleString()}</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
