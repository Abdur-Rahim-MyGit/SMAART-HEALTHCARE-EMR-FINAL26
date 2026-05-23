import React, { useState, useRef } from "react";
import { Camera, Upload, X, AlertCircle } from "lucide-react";

const ProfilePictureUpload = ({ currentPhoto, onPhotoUpdate, patientName }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB in bytes

  const validateFile = (file) => {
    setError("");

    if (!file) {
      setError("No file selected");
      return false;
    }

    // Check file type
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!allowedTypes.includes(file.type)) {
      setError("Please select a valid image file (JPEG, PNG, GIF, or WebP)");
      return false;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      setError("File size must be less than 3MB");
      return false;
    }

    return true;
  };

  const handleFileSelect = async (file) => {
    if (!validateFile(file)) return;

    setIsUploading(true);

    try {
      // Create a preview URL for the selected file
      const reader = new FileReader();
      reader.onload = (e) => {
        onPhotoUpdate(e.target.result);
        setIsUploading(false);
      };
      reader.onerror = () => {
        setError("Error reading file");
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError("Error uploading file");
      setIsUploading(false);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const removePhoto = () => {
    onPhotoUpdate(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Profile Picture Display */}
      <div className="relative">
        {currentPhoto ? (
          <div className="relative">
            <img
              src={currentPhoto}
              alt="Patient Profile"
              className="h-32 w-32 rounded-full object-cover border-4 border-white shadow-lg"
            />
            <button
              onClick={removePhoto}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
              title="Remove photo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="h-32 w-32 rounded-full bg-gradient-to-r from-[#cce0ff] to-[#ccebf0] flex items-center justify-center border-4 border-white shadow-lg">
            <span className="text-[#004D99] font-bold text-4xl">
              {patientName ? patientName[0].toUpperCase() : "P"}
            </span>
          </div>
        )}
      </div>

      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive
            ? "border-[#004D99] bg-blue-50"
            : "border-gray-300 hover:border-[#004D99]"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isUploading}
        />

        <div className="flex flex-col items-center space-y-2">
          {isUploading ? (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#004D99]"></div>
              <p className="text-sm text-gray-600">Uploading...</p>
            </>
          ) : (
            <>
              <Camera className="h-8 w-8 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Drop your image here, or{" "}
                  <button
                    type="button"
                    onClick={openFileDialog}
                    className="text-[#004D99] hover:text-[#003d80] font-semibold"
                  >
                    browse
                  </button>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  PNG, JPG, GIF, WebP up to 3MB
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center space-x-2 text-red-600 text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Upload Button */}
      <button
        onClick={openFileDialog}
        disabled={isUploading}
        className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-[#004D99] to-[#42A89B] text-white rounded-lg hover:from-[#003d80] hover:to-[#3a7d92] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Upload className="h-4 w-4" />
        <span>{isUploading ? "Uploading..." : "Upload Photo"}</span>
      </button>
    </div>
  );
};

export default ProfilePictureUpload;
