import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  if (!cloudName) {
    return NextResponse.json({ error: "Cloudinary not configured" }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const uploadFormData = new FormData();
  uploadFormData.append("file", file);
  uploadFormData.append("upload_preset", "galaxy_docs");
  uploadFormData.append("folder", "project-documents");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    { method: "POST", body: uploadFormData }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    return NextResponse.json(
      { error: err?.error?.message || "Upload failed" },
      { status: response.status }
    );
  }

  const data = await response.json();
  const isPdf = file.type === "application/pdf";
  const url: string = isPdf
    ? data.secure_url.replace(/\.pdf$/i, ".jpg")
    : data.secure_url;
  return NextResponse.json({ url, publicId: data.public_id });
}
