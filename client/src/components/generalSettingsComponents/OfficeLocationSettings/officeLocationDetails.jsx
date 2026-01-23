import React from "react";
import {
  MapPin,
  Phone,
  Building2,
  Edit2,
  Trash2,
  Info,
  Navigation,
} from "lucide-react";
import { CustomButton } from "../../customButton";

const OfficeLocationDetails = ({ selectedOffice, onEdit, onDelete }) => {
  // --- EMPTY STATE ---
  if (!selectedOffice) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-gray-50/50">
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 mb-6">
          <Building2 className="w-10 h-10 text-gray-300" />
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">
          No Office Selected
        </h3>
        <p className="text-gray-500 max-w-xs mx-auto mb-8">
          Select a provincial office from the list to view its contact
          information and location details.
        </p>

        <div className="grid grid-cols-1 gap-3 w-full max-w-sm">
          <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg text-left shadow-sm">
            <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center text-blue-500">
              <Info size={18} />
            </div>
            <p className="text-xs text-gray-600">
              Select an office to see full details.
            </p>
          </div>
          <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg text-left shadow-sm">
            <div className="w-8 h-8 rounded bg-amber-50 flex items-center justify-center text-amber-500">
              <Edit2 size={18} />
            </div>
            <p className="text-xs text-gray-600">
              Edit office names and addresses.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- DATA STATE ---
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header Section */}
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start gap-4 bg-gray-50/30">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-gray-900 leading-tight">
              {selectedOffice.name}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider">
              {selectedOffice.province || "Province Not Set"}
            </span>
            <span className="text-gray-400 text-xs flex items-center gap-1">
              <MapPin size={12} /> Office Record
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <CustomButton
            label={
              <span className="flex items-center gap-2">
                <Edit2 size={14} /> Edit Details
              </span>
            }
            variant="primary"
            className="!rounded-lg text-sm px-4 h-10"
            onClick={onEdit}
          />
          <button
            onClick={onDelete}
            className="h-10 w-10 flex items-center justify-center rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors shadow-sm"
            title="Delete Office"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Details Grid */}
      <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto">
        {/* Address Card */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <Navigation size={14} /> Location Details
          </h3>
          <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 group hover:border-blue-200 transition-colors">
            <p className="text-xs text-gray-500 mb-1 font-medium">
              Physical Address
            </p>
            <p className="text-gray-800 font-semibold leading-relaxed">
              {selectedOffice.address || "No address provided"}
            </p>
          </div>
          <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 group hover:border-blue-200 transition-colors">
            <p className="text-xs text-gray-500 mb-1 font-medium">
              Province / Region
            </p>
            <p className="text-gray-800 font-semibold">
              {selectedOffice.province || "N/A"}
            </p>
          </div>
        </div>

        {/* Contact Card */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <Phone size={14} /> Communication
          </h3>
          <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 group hover:border-blue-200 transition-colors">
            <p className="text-xs text-gray-500 mb-1 font-medium">
              Contact Number
            </p>
            <p className="text-gray-800 font-semibold text-lg">
              {selectedOffice.contact || "None"}
            </p>
          </div>

          <div className="p-5 rounded-xl border border-dashed border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                <Info size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-700">Quick Note</p>
                <p className="text-[11px] text-gray-500">
                  Ensure contact details are up to date for official
                  communications.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-auto p-4 bg-white border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-400 uppercase tracking-widest font-bold">
        <span>Database Record ID: {selectedOffice._id}</span>
        <span>Generated Admin View</span>
      </div>
    </div>
  );
};

export default OfficeLocationDetails;
