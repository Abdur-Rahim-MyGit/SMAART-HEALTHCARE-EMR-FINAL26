import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Search, Loader2 } from "lucide-react";
import { clinicsAPI } from "../../services/api";

const SOURCE_LABEL = {
  address: "Found from the full address",
  zip: "Found from the zip code only: drag the pin to the exact building",
  city: "Found from the city only: drag the pin to the exact building",
  pin: "Placed by hand",
};

// A plain HTML pin (no image files, so it works with any bundler setup).
const pinIcon = L.divIcon({
  className: "",
  html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#dc2626;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);transform:rotate(-45deg)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

/**
 * Clinic map point for the Add / Edit Clinic forms.
 * "Find on map" geocodes the address (on the server); the admin can drag the
 * pin or click the map to correct it. Calls onChange({ latitude, longitude, geoSource }).
 * When nothing is chosen here the server geocodes the address on save.
 */
export default function ClinicLocationPicker({ address, city, state, zipCode, country, value, onChange, disabled }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const lat = value && value.latitude != null && value.latitude !== "" ? Number(value.latitude) : null;
  const lng = value && value.longitude != null && value.longitude !== "" ? Number(value.longitude) : null;
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng);

  // Create the map once a point exists; move the pin when the point changes.
  useEffect(() => {
    if (!hasPoint || !mapEl.current) return;
    if (!mapRef.current) {
      const map = L.map(mapEl.current, { scrollWheelZoom: false }).setView([lat, lng], 16);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
      const marker = L.marker([lat, lng], { draggable: !disabled, icon: pinIcon }).addTo(map);
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        onChange({ latitude: +p.lat.toFixed(6), longitude: +p.lng.toFixed(6), geoSource: "pin" });
      });
      map.on("click", (e) => {
        if (disabled) return;
        marker.setLatLng(e.latlng);
        onChange({ latitude: +e.latlng.lat.toFixed(6), longitude: +e.latlng.lng.toFixed(6), geoSource: "pin" });
      });
      mapRef.current = map;
      markerRef.current = marker;
      setTimeout(() => map.invalidateSize(), 50); // inside a modal the size settles after open
    } else {
      const cur = markerRef.current.getLatLng();
      if (Math.abs(cur.lat - lat) > 1e-7 || Math.abs(cur.lng - lng) > 1e-7) {
        markerRef.current.setLatLng([lat, lng]);
        mapRef.current.setView([lat, lng], Math.max(mapRef.current.getZoom(), 15));
      }
    }
  }, [hasPoint, lat, lng, disabled, onChange]);

  useEffect(() => () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } }, []);

  const find = async () => {
    if (!address && !city && !zipCode) {
      setMessage({ type: "error", text: "Fill in the address, city or zip code first." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await clinicsAPI.geocode({ address, city, state, zipCode, country });
      const d = res.data || {};
      if (d.found) {
        onChange({ latitude: d.latitude, longitude: d.longitude, geoSource: d.source });
        setMessage({ type: "ok", text: d.displayName ? `Found: ${d.displayName}` : "Found on the map." });
      } else {
        setMessage({ type: "error", text: d.message || "Could not find this address on the map." });
      }
    } catch (err) {
      setMessage({ type: "error", text: err?.response?.data?.message || "The map lookup is not available right now. The address will be looked up again when you save." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="md:col-span-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MapPin className="h-4 w-4 text-red-600" /> Location on map
        </div>
        <button
          type="button"
          onClick={find}
          disabled={busy || disabled}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {hasPoint ? "Find again from address" : "Find on map"}
        </button>
      </div>

      {message && (
        <div className={`text-xs ${message.type === "ok" ? "text-green-700 dark:text-green-400" : "text-red-600"}`}>{message.text}</div>
      )}

      {hasPoint ? (
        <>
          <div ref={mapEl} style={{ height: 260 }} className="w-full rounded-md overflow-hidden border border-gray-200 dark:border-gray-700" />
          <div className="flex flex-wrap justify-between gap-2 text-xs text-gray-600 dark:text-gray-400">
            <span>Latitude <b>{lat.toFixed(6)}</b> · Longitude <b>{lng.toFixed(6)}</b></span>
            <span>{SOURCE_LABEL[value.geoSource] || ""}</span>
          </div>
          <div className="text-xs text-gray-500">Drag the pin, or click the map, to set the exact entrance. Patients use this point to find the nearest hospital.</div>
        </>
      ) : (
        <div className="text-xs text-gray-500">
          Press "Find on map" to check the location. If you skip this, the address is looked up automatically when you save.
        </div>
      )}
    </div>
  );
}
