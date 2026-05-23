import React from "react";
import {
  X,
  Phone,
  Mail,
  MapPin,
  Calendar,
  User,
  Heart,
  CreditCard,
  History,
} from "lucide-react";
import { format } from "date-fns";

const PatientViewModal = ({ isOpen, onClose, patient }) => {
  if (!isOpen || !patient) return null;

  const getAgeFromDOB = (dateOfBirth) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full mx-4 max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-4">
            {/* Patient photo */}
            {patient.photo ? (
              <img
                src={patient.photo}
                alt="Patient"
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                {patient.fullName ? patient.fullName[0].toUpperCase() : "P"}
              </div>
            )}

            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {patient.fullName}
              </h2>
              <p className="text-gray-600">
                PID: {patient.pid} | UHID: {patient.uhid}
              </p>
              <span
                className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-semibold ${
                  patient.status === "Active"
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {patient.status || "Active"}
              </span>
            </div>
          </div>

          {/* Wallet balances */}
          <div className="flex space-x-4">
            <div className="bg-gray-100 px-4 py-2 rounded-lg text-sm">
              General Wallet:{" "}
              <span className="font-bold text-gray-800">
                {patient.wallets?.general || 0}
              </span>
            </div>
            <div className="bg-gray-100 px-4 py-2 rounded-lg text-sm">
              Pharmacy Wallet:{" "}
              <span className="font-bold text-gray-800">
                {patient.wallets?.pharmacy || 0}
              </span>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg"
          >
            <X className="h-6 w-6 text-gray-600" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Basic Info + Contact + Address */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
                <User className="h-5 w-5 mr-2 text-gray-500" /> Basic Info
              </h3>
              <p>Age: {getAgeFromDOB(patient.dateOfBirth)} years</p>
              <p>Gender: {patient.gender}</p>
              <p>
                DOB:{" "}
                {patient.dateOfBirth
                  ? format(new Date(patient.dateOfBirth), "dd MMM yyyy")
                  : "N/A"}
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
                <Phone className="h-5 w-5 mr-2 text-gray-500" /> Contact
              </h3>
              <p>{patient.phone}</p>
              {patient.email && <p>{patient.email}</p>}
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
                <MapPin className="h-5 w-5 mr-2 text-gray-500" /> Address
              </h3>
              <p>{patient.address?.street}</p>
              <p>
                {patient.address?.city}, {patient.address?.state}{" "}
                {patient.address?.zipCode}
              </p>
              <p>{patient.address?.country}</p>
            </div>
          </div>

          {/* Clinic Category History */}
          {patient.categoryHistory && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <History className="h-5 w-5 mr-2 text-gray-500" /> Clinic
                Category History
              </h3>
              <p>Old: {patient.categoryHistory.old || "-"}</p>
              <p>New: {patient.categoryHistory.new}</p>
              <p>
                Date:{" "}
                {patient.categoryHistory.date &&
                  format(
                    new Date(patient.categoryHistory.date),
                    "dd MMM yyyy, hh:mm a"
                  )}
              </p>
            </div>
          )}

          {/* Clinic Visit History */}
          {patient.visits?.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-gray-500" /> Clinic Visit
                History
              </h3>
              <table className="w-full text-sm border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left p-2">Clinic</th>
                    <th className="text-left p-2">Code</th>
                    <th className="text-left p-2">Check-in</th>
                    <th className="text-left p-2">Check-out</th>
                  </tr>
                </thead>
                <tbody>
                  {patient.visits.map((visit, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2">{visit.clinicName}</td>
                      <td className="p-2">{visit.clinicCode}</td>
                      <td className="p-2">
                        {format(
                          new Date(visit.checkIn),
                          "dd MMM yyyy, hh:mm a"
                        )}
                      </td>
                      <td className="p-2">
                        {visit.checkOut
                          ? format(
                              new Date(visit.checkOut),
                              "dd MMM yyyy, hh:mm a"
                            )
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Payment History */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <CreditCard className="h-5 w-5 mr-2 text-gray-500" /> Payment
              History
            </h3>

            {/* Credit */}
            {patient.payments?.credits?.length > 0 && (
              <>
                <h4 className="font-semibold text-gray-800">Credits</h4>
                <ul className="mb-4">
                  {patient.payments.credits.map((credit, idx) => (
                    <li
                      key={idx}
                      className="flex justify-between border-b py-1 text-sm"
                    >
                      <span>
                        {credit.mode} | Ref: {credit.reference} | By:{" "}
                        {credit.createdBy}
                      </span>
                      <span>₹{credit.amount}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* Debit */}
            {patient.payments?.debits?.length > 0 && (
              <>
                <h4 className="font-semibold text-gray-800">Debits</h4>
                <ul>
                  {patient.payments.debits.map((debit, idx) => (
                    <li
                      key={idx}
                      className="flex justify-between border-b py-1 text-sm"
                    >
                      <span>
                        {debit.mode} | Ref: {debit.reference} | Details:{" "}
                        {debit.details}
                      </span>
                      <span>₹{debit.amount}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PatientViewModal;
