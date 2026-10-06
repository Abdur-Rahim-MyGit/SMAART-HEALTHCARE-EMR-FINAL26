/**
 * Appointments are shown as two kinds of visit only. "Virtual" for any video
 * appointment (the is_virtual flag, the Consultant's "Teleconsultation" type or
 * the Physio app's "virtual_video"); "In Person" for everything else.
 */
export const appointmentModeLabel = (a) =>
  a?.isVirtual === true ||
  a?.appointmentType === "Teleconsultation" ||
  a?.type === "Teleconsultation" ||
  a?.appointmentType === "virtual_video" ||
  a?.type === "virtual_video"
    ? "Virtual"
    : "In Person";
