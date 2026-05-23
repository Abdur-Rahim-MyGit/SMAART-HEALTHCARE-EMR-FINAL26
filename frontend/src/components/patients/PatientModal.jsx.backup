import React from "react";
import { X, Wallet } from "lucide-react";
import { format } from "date-fns";

// Helper component for creating titled sections
const DetailSection = ({ title, children }) => (
  <div className="mb-8">
    <h3 className="text-lg font-semibold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">
      {title}
    </h3>
    {children}
  </div>
);

// Reusable component for history tables
const HistoryTable = ({ headers, data, renderRow, totals }) => (
  <div className="overflow-x-auto rounded-lg border">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          {headers.map((header) => (
            <th
              key={header}
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {data && data.length > 0 ? (
          data.map(renderRow)
        ) : (
          <tr>
            <td
              colSpan={headers.length}
              className="px-4 py-4 text-center text-sm text-gray-500"
            >
              No data available.
            </td>
          </tr>
        )}
      </tbody>
      {totals && (
        <tfoot className="bg-gray-50">
          <tr>
            <td
              colSpan={headers.length - 1}
              className="px-4 py-3 text-right text-sm font-bold text-gray-700"
            >
              Total
            </td>
            <td className="px-4 py-3 text-left text-sm font-bold">
              <span className="bg-green-200 text-green-800 px-3 py-1 rounded-md">
                {totals.amount}
              </span>
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  </div>
);

const PatientViewModal = ({ isOpen, onClose, patient }) => {
  if (!isOpen || !patient) return null;

  const getAgeFromDOB = (dateOfBirth) => {
    if (!dateOfBirth) return "N/A";
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
      <div className="bg-gray-50 rounded-lg shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-white rounded-t-lg">
          <div className="flex items-center gap-4">
            <img
              src={patient.imageUrl}
              alt="Patient"
              className="w-12 h-12 rounded-full object-cover"
            />
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                {patient.fullName}
                <span className="bg-red-100 text-red-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  {patient.category}
                </span>
              </h2>
              <p className="text-sm text-gray-500">
                PID: {patient.pid} | Mobile: {patient.attenderMobile}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-right">
              <p className="font-semibold text-gray-700 flex items-center gap-2">
                <Wallet size={16} className="text-green-600" /> General Wallet:{" "}
                <span className="font-bold">
                  ₹{patient.wallet?.general?.toFixed(2) || "0.00"}
                </span>
              </p>
              <p className="font-semibold text-gray-700 flex items-center gap-2">
                <Wallet size={16} className="text-blue-600" /> Pharmacy Wallet:{" "}
                <span className="font-bold">
                  ₹{patient.wallet?.pharmacy?.toFixed(2) || "0.00"}
                </span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto">
          <nav
            className="-mb-px flex space-x-8 border-b border-gray-200 mb-6"
            aria-label="Tabs"
          >
            <a
              href="#"
              className="border-blue-500 text-blue-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm"
            >
              Patient Profile
            </a>
            <a
              href="#"
              className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm"
            >
              Case Log
            </a>
          </nav>

          <DetailSection title="">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div className="flex">
                <strong className="w-32 text-gray-500">First Name:</strong>
                <span className="text-gray-800">
                  {patient.fullName?.split(" ")[0]}
                </span>
              </div>
              <div className="flex">
                <strong className="w-32 text-gray-500">Last Name:</strong>
                <span className="text-gray-800">{patient.lastName}</span>
              </div>
              <div className="flex">
                <strong className="w-32 text-gray-500">Gender:</strong>
                <span className="text-gray-800 capitalize">
                  {patient.gender}
                </span>
              </div>
              <div className="flex">
                <strong className="w-32 text-gray-500">DOB & Age:</strong>
                <span className="text-gray-800">
                  {patient.dateOfBirth
                    ? `${format(
                        new Date(patient.dateOfBirth),
                        "dd/MM/yyyy"
                      )} & ${getAgeFromDOB(patient.dateOfBirth)}`
                    : "N/A"}
                </span>
              </div>
              <div className="flex">
                <strong className="w-32 text-gray-500">Mobile No:</strong>
                <span className="text-gray-800">{patient.attenderMobile}</span>
              </div>
              <div className="flex">
                <strong className="w-32 text-gray-500">City:</strong>
                <span className="text-gray-800">{patient.city}</span>
              </div>
              <div className="flex">
                <strong className="w-32 text-gray-500">Pincode:</strong>
                <span className="text-gray-800">{patient.pinCode}</span>
              </div>
            </div>
          </DetailSection>

          <DetailSection title="Clinic Category History">
            <HistoryTable
              headers={["S.No", "Old Category", "New Category", "Dated On"]}
              data={patient.clinicCategoryHistory}
              renderRow={(item) => (
                <tr key={item.sno}>
                  <td className="px-4 py-3 text-sm">{item.sno}</td>
                  <td className="px-4 py-3 text-sm">{item.oldCategory}</td>
                  <td className="px-4 py-3 text-sm">{item.newCategory}</td>
                  <td className="px-4 py-3 text-sm">
                    {format(new Date(item.datedOn), "PPp")}
                  </td>
                </tr>
              )}
            />
          </DetailSection>

          <DetailSection title="CheckIn History">
            <HistoryTable
              headers={["S.No", "Clinic Type", "Clinic Name", "CheckIn On"]}
              data={patient.checkInHistory}
              renderRow={(item) => (
                <tr key={item.sno}>
                  <td className="px-4 py-3 text-sm">{item.sno}</td>
                  <td className="px-4 py-3 text-sm">{item.clinicType}</td>
                  <td className="px-4 py-3 text-sm">{item.clinicName}</td>
                  <td className="px-4 py-3 text-sm">
                    {format(new Date(item.checkedInOn), "PPp")}
                  </td>
                </tr>
              )}
            />
          </DetailSection>

          <DetailSection title="Payment Credit History">
            <HistoryTable
              headers={[
                "S.No",
                "Pay Mode",
                "Reference",
                "Credited By",
                "Credited On",
                "Amount",
              ]}
              data={patient.paymentCreditHistory}
              renderRow={(item) => (
                <tr key={item.sno}>
                  <td className="px-4 py-3 text-sm">{item.sno}</td>
                  <td className="px-4 py-3 text-sm">{item.payMode}</td>
                  <td className="px-4 py-3 text-sm">{item.reference}</td>
                  <td className="px-4 py-3 text-sm">{item.creditedBy}</td>
                  <td className="px-4 py-3 text-sm">
                    {format(new Date(item.creditedOn), "PPp")}
                  </td>
                  <td className="px-4 py-3 text-sm text-green-600 font-bold">
                    {item.amount.toFixed(2)}
                  </td>
                </tr>
              )}
              totals={{ amount: "5000" }}
            />
          </DetailSection>

          <DetailSection title="Payment Debit History">
            <HistoryTable
              headers={[
                "S.No.",
                "Pay Type",
                "Reference",
                "Details",
                "Debited On",
                "Amount",
              ]}
              data={patient.paymentDebitHistory}
              renderRow={(item) => (
                <tr key={item.sno}>
                  <td className="px-4 py-3 text-sm">{item.sno}</td>
                  <td className="px-4 py-3 text-sm">{item.payType}</td>
                  <td className="px-4 py-3 text-sm">{item.reference}</td>
                  <td className="px-4 py-3 text-sm">{item.details}</td>
                  <td className="px-4 py-3 text-sm">
                    {format(new Date(item.debitedOn), "PPp")}
                  </td>
                  <td className="px-4 py-3 text-sm text-red-600 font-bold">
                    {item.amount.toFixed(2)}
                  </td>
                </tr>
              )}
            />
          </DetailSection>
        </div>
      </div>
    </div>
  );
};

export default PatientViewModal;
