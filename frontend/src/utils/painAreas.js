/**
 * Body-map ids from the Physio app are slugs such as "right_knee", "lower_back"
 * or "left_shoulder_back". Shown as "Knee (Right)", "Lower Back",
 * "Shoulder (Left, Back)": the part first, then the side in brackets.
 */
export const painAreaLabel = (a) => {
  const tokens = String(a.bodyPart || "").toLowerCase().split(/[_\s]+/).filter(Boolean);
  const qualifiers = [];
  const parts = [];
  const hasSide = tokens.includes("left") || tokens.includes("right");
  tokens.forEach((t, i) => {
    if (t === "left" || t === "right") qualifiers.push(t);
    else if (t === "back" && hasSide && i === tokens.length - 1 && parts.length > 0) qualifiers.push("back");
    else parts.push(t);
  });
  if (a.side && a.side !== "center" && !qualifiers.includes(a.side)) qualifiers.unshift(a.side);
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
  const name = parts.map(cap).join(" ");
  return qualifiers.length ? `${name} (${qualifiers.map(cap).join(", ")})` : name;
};

/** "Knee (Right), Lower Back" from the body-map selection; '' when none. */
export const painLocation = (areas) => {
  if (!Array.isArray(areas) || areas.length === 0) return "";
  const seen = new Set();
  const out = [];
  for (const a of areas) {
    if (!a || !a.bodyPart) continue;
    const label = painAreaLabel(a);
    if (label && !seen.has(label.toLowerCase())) { seen.add(label.toLowerCase()); out.push(label); }
  }
  return out.join(", ");
};

/** "Knee (Right) • Pain 8/10 • Less than 1 week" for an appointment, or ''. */
export const painSummary = (appointment) => {
  if (!appointment) return "";
  return [
    painLocation(appointment.painAreas),
    appointment.painLevel ? `Pain ${appointment.painLevel}/10` : null,
    appointment.painDuration || null,
  ].filter(Boolean).join(" • ");
};
