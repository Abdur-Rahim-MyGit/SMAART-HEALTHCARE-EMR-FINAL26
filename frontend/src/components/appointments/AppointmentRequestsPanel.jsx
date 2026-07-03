import React, { useEffect, useState } from "react";
import {
  Inbox, Check, X, Phone, Mail, MapPin, Calendar, Clock, ChevronDown, ChevronUp, RefreshCw,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { appointmentRequestsAPI } from "../../services/api";

/**
 * Panel at the top of the EMR Appointments page. Lists appointment requests that
 * patients submitted from the public SMAART appointment website, and lets the
 * hospital approve or reject them.
 *
 * Props:
 *   onReviewed?: () => void  — called after a request is approved/rejected.
 */
const prettyService = (s) => {
  const map = {
    physio: "Physiotherapy", minds: "Mental Health", balance: "Balance", eyes: "Eye Care",
    reprox: "Reprox", nutrition: "Nutrition", blood_parameters: "Blood Tests", pharmacy: "Pharmacy",
  };
  return map[s] || String(s).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const fmtDate = (d) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
};

const AppointmentRequestsPanel = ({ onReviewed }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [actingId, setActingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await appointmentRequestsAPI.getAll("pending");
      const data = res.data || res;
      setRequests(data.requests || []);
    } catch (e) {
      console.warn("Could not load appointment requests:", e?.message);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const review = async (id, status) => {
    setActingId(id);
    try {
      await appointmentRequestsAPI.review(id, status);
      setRequests((prev) => prev.filter((r) => r._id !== id));
      toast.success(status === "approved" ? "Request approved" : "Request rejected");
      if (onReviewed) onReviewed();
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Could not update the request");
    } finally {
      setActingId(null);
    }
  };

  const count = requests.length;

  return (
    <div className="bg-blue-50/60 dark:bg-gray-800 border border-blue-100 dark:border-gray-700 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Inbox className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-blue-900 dark:text-white">Appointment Requests</h2>
          {count > 0 && (
            <span className="ml-1 inline-flex items-center rounded-full bg-blue-600 text-white text-xs font-semibold px-2 py-0.5">
              {count} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={load} title="Refresh" className="p-1.5 rounded-md text-blue-700 hover:bg-blue-100 dark:hover:bg-gray-700">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setExpanded((v) => !v)} className="p-1.5 rounded-md text-blue-700 hover:bg-blue-100 dark:hover:bg-gray-700">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4">
          {loading ? (
            <div className="text-sm text-gray-500 py-4 text-center">Loading requests…</div>
          ) : count === 0 ? (
            <div className="text-sm text-gray-500 py-4 text-center">
              No new appointment requests from the website.
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => (
                <div key={r._id} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-900 dark:text-white">{r.patientName || "Unknown"}</div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
                        {r.mobileNumber && (
                          <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{r.mobileNumber}</span>
                        )}
                        {r.email && (
                          <span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{r.email}</span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
                        {r.clinicName && (
                          <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{r.clinicName}</span>
                        )}
                        <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{fmtDate(r.preferredDate)}</span>
                        {r.preferredTime && (
                          <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{r.preferredTime}</span>
                        )}
                      </div>
                      {Array.isArray(r.services) && r.services.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {r.services.map((s, i) => (
                            <span key={i} className="text-xs font-normal bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-full px-2 py-0.5">
                              {prettyService(s)}
                            </span>
                          ))}
                        </div>
                      )}
                      {r.notes && <div className="mt-2 text-sm text-gray-500 italic">“{r.notes}”</div>}
                      <div className="mt-1 text-xs text-gray-400">
                        {r.appointmentType === "virtual_video" ? "Virtual video call" : "In-person visit"}
                      </div>
                    </div>

                    <div className="flex sm:flex-col gap-2 flex-shrink-0">
                      <button
                        disabled={actingId === r._id}
                        onClick={() => review(r._id, "approved")}
                        className="inline-flex items-center justify-center gap-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium py-2 px-3 rounded-lg"
                      >
                        <Check className="w-4 h-4" /> Approve
                      </button>
                      <button
                        disabled={actingId === r._id}
                        onClick={() => review(r._id, "rejected")}
                        className="inline-flex items-center justify-center gap-1 border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 text-sm font-medium py-2 px-3 rounded-lg"
                      >
                        <X className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AppointmentRequestsPanel;
