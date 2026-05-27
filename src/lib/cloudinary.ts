import imageCompression from "browser-image-compression";

interface CloudinaryUploadResult {
  url: string;
  publicId: string;
}

/**
 * Compresses an image client-side and uploads it to Cloudinary using unsigned uploads.
 * 
 * @param file The file object captured from input or mobile camera
 * @returns Promise resolving to the secure URL and public ID from Cloudinary
 */
export async function uploadImageToCloudinary(file: File): Promise<CloudinaryUploadResult> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Cloudinary environment variables (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET) are not configured."
    );
  }

  // 1. Compress the image before uploading to optimize performance and bandwidth (especially on mobile)
  const compressionOptions = {
    maxSizeMB: 1, // Max size 1MB
    maxWidthOrHeight: 1600, // Max dimension 1600px
    useWebWorker: false, // Set to false to avoid WebWorker failures on mobile browsers (Safari/Chrome)
  };

  let fileToUpload = file;
  try {
    fileToUpload = await imageCompression(file, compressionOptions);
  } catch (error) {
    console.error("Image compression failed for file: " + file.name, error);
  }

  // 2. Prepare FormData for Cloudinary Unsigned Upload
  const formData = new FormData();
  // Ensure the file has a valid name and extension so Cloudinary's unsigned uploader correctly processes it on mobile devices
  const filename = fileToUpload.name || "mobile_upload.jpg";
  formData.append("file", fileToUpload, filename);
  formData.append("upload_preset", uploadPreset);

  // 3. Post to Cloudinary's unsigned upload API endpoint
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const response = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errResponse = await response.json().catch(() => ({}));
    const errMsg = errResponse?.error?.message || `HTTP error! status: ${response.status}`;
    throw new Error(`Cloudinary upload failed: ${errMsg}`);
  }

  const data = await response.json();

  if (!data.secure_url || !data.public_id) {
    throw new Error("Invalid response received from Cloudinary.");
  }

  return {
    url: data.secure_url,
    publicId: data.public_id,
  };
}
