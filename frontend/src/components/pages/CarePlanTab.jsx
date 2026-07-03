import React, { useEffect, useState } from "react";
import { Activity, Dumbbell, Target, CalendarClock, BrainCircuit, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { carePlanAPI } from "../../services/api";

/**
 * Treatment Plan tab in the EMR patient view — shows the Physio treatment plan +
 * CDSS history produced on the Consultant side (read from the shared DB).
 */
const fmt = (d) => { try { return new Date(d).toLocaleDateString(); } catch { return "—"; } };

const CarePlanTab = ({ patient }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const pid = patient?.id || patient?._id;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await carePlanAPI.get(pid);
        if (alive) setData(res.data || res);
      } catch {
        if (alive) setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [pid]);

  if (loading) return <div className="text-center text-gray-500 py-10">Loading treatment plan…</div>;
  if (!data || (!data.treatmentPlan && (!data.cdss || data.cdss.length === 0))) {
    return (
      <div className="text-center text-gray-400 py-10">
        <Activity className="w-10 h-10 mx-auto mb-3 opacity-40" />
        No treatment plan or CDSS record for this patient yet.
        {data && !data.hasAppAccount && <div className="text-xs mt-2">(No SMAART app account linked by email.)</div>}
      </div>
    );
  }

  const tp = data.treatmentPlan;
  return (
    <div className="space-y-6">
      {/* Active treatment plan */}
      {tp && (
        <div className="bg-white dark:bg-gray-950 rounded-lg p-5 shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-[#004D99]" /> Active treatment plan
            </h3>
            <span className="text-xs text-gray-400">{fmt(tp.publishedAt || tp.createdAt)}</span>
          </div>
          {tp.diagnosis && <div className="text-sm text-gray-600 dark:text-gray-300 mb-3"><strong>Diagnosis:</strong> {tp.diagnosis}</div>}
          <div className="space-y-2">
            {(tp.exercises || []).map((e, i) => (
              <div key={i} className="flex items-center justify-between text-sm border border-gray-100 dark:border-gray-800 rounded-lg px-3 py-2">
                <span className="text-gray-800 dark:text-gray-200">{e.exerciseName || "Exercise"}</span>
                <span className="text-gray-500">{e.sets}×{e.reps}{e.frequency ? ` · ${e.frequency}` : ""}</span>
              </div>
            ))}
          </div>
          {Array.isArray(tp.recoveryGoals) && tp.recoveryGoals.length > 0 && (
            <div className="mt-3 text-sm text-gray-600 dark:text-gray-300">
              <div className="flex items-center gap-1.5 font-medium mb-1"><Target className="w-4 h-4 text-green-600" /> Goals</div>
              <ul className="list-disc pl-6">{tp.recoveryGoals.map((g, i) => <li key={i}>{g.description}</li>)}</ul>
            </div>
          )}
          {tp.followUpSchedule && (
            <div className="mt-3 text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
              <CalendarClock className="w-4 h-4 text-gray-400" /> <strong>Review:</strong> {tp.followUpSchedule}
            </div>
          )}
        </div>
      )}

      {/* CDSS history */}
      {Array.isArray(data.cdss) && data.cdss.length > 0 && (
        <div className="bg-white dark:bg-gray-950 rounded-lg p-5 shadow-sm border border-gray-100 dark:border-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
            <BrainCircuit className="w-5 h-5 text-[#004D99]" /> CDSS history
          </h3>
          <div className="space-y-3">
            {data.cdss.map((c, i) => {
              const acc = c.physio_action?.accepted?.length || 0;
              const rej = c.physio_action?.rejected?.length || 0;
              const redFlag = String(c.result?.red_flag).toLowerCase() === "yes";
              return (
                <div key={i} className="border border-gray-100 dark:border-gray-800 rounded-lg p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {c.result?.diagnosis || "Assessment"} · {c.result?.phase || ""}
                    </span>
                    <span className="text-xs text-gray-400">{fmt(c.createdAt)}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-xs">
                    {redFlag && <span className="inline-flex items-center gap-1 text-red-600"><AlertTriangle className="w-3.5 h-3.5" /> Red flag</span>}
                    <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 className="w-3.5 h-3.5" /> {acc} accepted</span>
                    <span className="inline-flex items-center gap-1 text-red-500"><XCircle className="w-3.5 h-3.5" /> {rej} rejected</span>
                    {c.quality_tier && <span className="text-gray-400">tier: {c.quality_tier}</span>}
                  </div>
                  {rej > 0 && (
                    <div className="mt-1.5 text-xs text-gray-500">
                      Rejected reasons: {c.physio_action.rejected.map((r) => r.reason_code).filter(Boolean).join(", ") || "—"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CarePlanTab;
