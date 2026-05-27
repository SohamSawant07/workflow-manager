"use client";

import { useState, useRef } from "react";
import type { Project } from "@/types";
import { useAuthContext } from "@/components/providers/AuthProvider";
import { useProjectPhotos } from "@/hooks/useProjectPhotos";
import { addProjectPhoto, deleteProjectPhoto } from "@/lib/firestore/projects";
import { canUploadPhoto, canDeletePhoto } from "@/lib/auth/permissions";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { formatDate } from "@/lib/utils/dates";

interface ProjectPhotosProps {
  projectId: string;
  project: Project;
}

export function ProjectPhotos({ projectId, project }: ProjectPhotosProps) {
  const { user } = useAuthContext();
  const { photos, loading: photosLoading } = useProjectPhotos(projectId);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // States
  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  
  // State for delete confirmation
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const allowedToUpload = canUploadPhoto(user, project);
  const allowedToDelete = canDeletePhoto(user, project);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await uploadFiles(Array.from(files));
  };

  const uploadFiles = async (files: File[]) => {
    setUploadingCount(files.length);
    setUploadError("");

    let successCount = 0;
    let failCount = 0;
    let lastErrorMessage = "";

    for (const file of files) {
      try {
        const result = await uploadImageToCloudinary(file);
        await addProjectPhoto(projectId, result.url, result.publicId);
        successCount++;
      } catch (err: any) {
        console.error("Upload failed for file: ", file.name, err);
        lastErrorMessage = err?.message || String(err);
        failCount++;
      } finally {
        setUploadingCount((prev) => Math.max(0, prev - 1));
      }
    }

    if (failCount > 0) {
      const errorMsg = lastErrorMessage
        ? `Failed to upload ${failCount} of ${files.length} images. Reason: ${lastErrorMessage}`
        : `Failed to upload ${failCount} of ${files.length} images. Please check your connection and try again.`;
      setUploadError(errorMsg);
    }

    // Reset inputs
    if (galleryInputRef.current) {
      galleryInputRef.current.value = "";
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!photoToDelete) return;
    setDeleteLoading(true);
    try {
      await deleteProjectPhoto(projectId, photoToDelete);
      setPhotoToDelete(null);
    } catch (err) {
      console.error(err);
      alert("Failed to delete photo");
    } finally {
      setDeleteLoading(false);
    }
  };

  const triggerGalleryUpload = () => {
    if (galleryInputRef.current) {
      galleryInputRef.current.click();
    }
  };

  const triggerCameraUpload = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm transition-all space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-150 pb-4 dark:border-zinc-800">
        <div>
          <h2 className="text-md font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Site Images ({photos.length})
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Capture and track visual progress of the automation layout.
          </p>
        </div>

        {allowedToUpload && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <input
              type="file"
              ref={galleryInputRef}
              onChange={handleFileChange}
              multiple
              accept="image/*"
              className="hidden"
            />
            <input
              type="file"
              ref={cameraInputRef}
              onChange={handleFileChange}
              accept="image/*"
              capture="environment"
              className="hidden"
            />
            <Button
              onClick={triggerGalleryUpload}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 font-medium"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Choose from Gallery
            </Button>
            <Button
              onClick={triggerCameraUpload}
              variant="secondary"
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 font-medium border border-zinc-200 dark:border-zinc-800"
            >
              <svg className="h-4 w-4 text-zinc-500 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Take Photo
            </Button>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/20 dark:text-red-400">
          {uploadError}
        </div>
      )}

      {photosLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : photos.length === 0 && uploadingCount === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-200 p-8 text-center dark:border-zinc-800">
          <svg className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            No site photos have been uploaded for this project yet.
          </p>
          {allowedToUpload && (
            <div className="mt-4 flex items-center justify-center gap-4">
              <button
                onClick={triggerGalleryUpload}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                Choose from Gallery
              </button>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <button
                onClick={triggerCameraUpload}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                Take Photo
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {/* Upload Skeletons */}
          {Array.from({ length: uploadingCount }).map((_, i) => (
            <div
              key={`upload-skeleton-${i}`}
              className="aspect-square relative rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/20 flex flex-col items-center justify-center space-y-2 animate-pulse"
            >
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                <Spinner className="!h-5 !w-5" />
              </div>
              <span className="text-[10px] font-medium text-zinc-400">Uploading...</span>
            </div>
          ))}

          {/* Photo Cards */}
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group aspect-square relative rounded-xl border border-zinc-150 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/20 overflow-hidden shadow-sm hover:shadow-md hover:ring-1 hover:ring-indigo-500/25 transition-all"
            >
              {/* Image element */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={`Site photo uploaded by ${photo.uploadedBy}`}
                className="w-full h-full object-cover cursor-zoom-in group-hover:scale-105 transition-transform duration-300"
                onClick={() => setLightboxUrl(photo.url)}
              />

              {/* Text overlays / actions on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3 pointer-events-none">
                {/* Delete button (positioned at top right) */}
                <div className="flex justify-end pointer-events-auto">
                  {allowedToDelete && (
                    <button
                      onClick={() => setPhotoToDelete(photo.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-600/90 text-white hover:bg-red-700 transition-colors shadow-sm"
                      title="Delete photo"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Metadata details (positioned at bottom) */}
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-zinc-200 truncate">
                    By {photo.uploadedBy}
                  </p>
                  <p className="text-[9px] text-zinc-300 font-medium">
                    {photo.uploadedAt ? formatDate(photo.uploadedAt) : "—"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Zoom Overlay */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center cursor-zoom-out p-4 md:p-8"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 text-white hover:text-zinc-300 transition-colors p-2 bg-zinc-800/40 rounded-full hover:bg-zinc-800/60"
            title="Close viewer"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Site photo zoomed preview"
            className="max-w-full max-h-full rounded-lg object-contain shadow-2xl animate-fade-in"
          />
        </div>
      )}

      {/* Delete Photo Confirmation Modal */}
      {photoToDelete && (
        <Modal
          open={!!photoToDelete}
          onClose={() => setPhotoToDelete(null)}
          title="Delete photo?"
          footer={
            <>
              <Button variant="secondary" onClick={() => setPhotoToDelete(null)} disabled={deleteLoading}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleteLoading}>
                {deleteLoading ? "Deleting..." : "Delete Photo"}
              </Button>
            </>
          }
        >
          <p className="text-zinc-600 dark:text-zinc-400">
            Are you sure you want to delete this photo? This will permanently remove the photo and its metadata from the project record.
          </p>
        </Modal>
      )}
    </div>
  );
}
