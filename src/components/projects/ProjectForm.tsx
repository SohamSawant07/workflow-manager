"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useAuthContext } from "@/components/providers/AuthProvider";
import { createProject, updateProject } from "@/lib/firestore/projects";
import { toProjectCreator } from "@/lib/auth/user";
import { PROJECT_STATUSES } from "@/lib/constants";
import type { ProjectStatus } from "@/types";
import { DocumentBox, type DocItem } from "@/components/projects/ProjectDocuments";

export function ProjectForm() {

  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [siteManagerName, setSiteManagerName] = useState("");
  const [contacts, setContacts] = useState<{ designation: string; name: string; phone: string }[]>([
    { designation: "", name: "", phone: "" },
    { designation: "", name: "", phone: "" },
  ]);

  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [landmark, setLandmark] = useState("");
  const [googleMapsLink, setGoogleMapsLink] = useState("");
  const [startDate, setStartDate] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [sopItems, setSopItems] = useState<DocItem[]>([]);
  const [layoutItems, setLayoutItems] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuthContext();
  const router = useRouter();
  const uploadedBy = user?.displayName ?? user?.email ?? "Unknown";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError("");

    // Validate site manager
    if (!siteManagerName.trim()) {
      setError("Site Manager name is required.");
      setLoading(false);
      return;
    }

    // Validate contacts
    if (contacts.length < 2) {
      setError("At least 2 site contacts are required.");
      setLoading(false);
      return;
    }

    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i];
      if (!c.designation.trim() || !c.phone.trim()) {
        setError(`Contact #${i + 1} must have both Designation and Phone number filled.`);
        setLoading(false);
        return;
      }
    }

    try {
      const id = await createProject(
        {
          name,
          clientName,
          siteManagerName,
          ...(deadline ? { deadline } : {}),
          startDate,
          status,
          address,
          city,
          landmark,
          googleMapsLink,
          clientPhone,
          siteContacts: contacts,
        },
        toProjectCreator(user)
      );

      // Save SOP / Layout docs if any were uploaded during the form
      const docUpdates: Record<string, unknown> = {};
      if (sopItems.length) docUpdates.siteSOP = sopItems;
      if (layoutItems.length) docUpdates.siteLayout = layoutItems;
      if (Object.keys(docUpdates).length) {
        await updateProject(id, docUpdates as Parameters<typeof updateProject>[1]);
      }

      router.push(`/projects/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-xl space-y-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          General Details
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label="Project Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Villa Lighting & Automation"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <Input
              label="Client Name (optional)"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. John Smith"
            />
          </div>
          <div className="sm:col-span-2">
            <Input
              label="Site Manager"
              value={siteManagerName}
              onChange={(e) => setSiteManagerName(e.target.value)}
              placeholder="e.g. Raj Patel"
              required
            />
          </div>
          <div>
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div>
            <Input
              label="Deadline (optional)"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Select
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              options={PROJECT_STATUSES}
            />
          </div>
        </div>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Site & Location Details
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label="Client Phone Number"
              type="tel"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="e.g. +1 (555) 019-2834"
            />
          </div>
          <div className="sm:col-span-2">
            <Input
              label="Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Flat 402, Sunset Heights"
            />
          </div>
          <div>
            <Input
              label="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Mumbai"
            />
          </div>
          <div>
            <Input
              label="Landmark"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              placeholder="e.g. Near Central Park"
            />
          </div>
          <div className="sm:col-span-2">
            <Input
              label="Google Maps Link"
              type="url"
              value={googleMapsLink}
              onChange={(e) => setGoogleMapsLink(e.target.value)}
              placeholder="e.g. https://maps.app.goo.gl/..."
            />
          </div>
        </div>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
          Site Contacts
          <span className="text-xs font-normal text-red-500 lowercase">(Minimum 2 required)</span>
        </h3>
        
        <div className="space-y-3">
          {contacts.map((contact, index) => (
            <div key={index} className="rounded-xl border border-zinc-150 bg-zinc-50/50 p-4 dark:border-zinc-800 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-150 pb-2 dark:border-zinc-800">
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  Contact #{index + 1} {index < 2 && <span className="text-red-500 font-normal text-[10px] lowercase">(required)</span>}
                </span>
                {contacts.length > 2 && (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setContacts(contacts.filter((_, i) => i !== index));
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
              
              <div className="grid gap-4 sm:grid-cols-3">
                <Input
                  label="Designation"
                  value={contact.designation}
                  onChange={(e) => {
                    const updated = [...contacts];
                    updated[index] = { ...updated[index], designation: e.target.value };
                    setContacts(updated);
                  }}
                  placeholder="e.g. Electrician"
                  required
                />
                <Input
                  label="Name (optional)"
                  value={contact.name}
                  onChange={(e) => {
                    const updated = [...contacts];
                    updated[index] = { ...updated[index], name: e.target.value };
                    setContacts(updated);
                  }}
                  placeholder="e.g. John Doe"
                />
                <Input
                  label="Phone"
                  value={contact.phone}
                  onChange={(e) => {
                    const updated = [...contacts];
                    updated[index] = { ...updated[index], phone: e.target.value };
                    setContacts(updated);
                  }}
                  placeholder="e.g. +91 98765 43210"
                  required
                />
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full flex items-center justify-center gap-1 mt-2 font-medium"
            onClick={() => {
              setContacts([...contacts, { designation: "", name: "", phone: "" }]);
            }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Contact
          </Button>
        </div>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Site Documents <span className="text-xs font-normal text-zinc-400">(optional)</span>
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <DocumentBox
            title="Site SOP"
            subtitle="PDF, images, or Excel · up to 10 files"
            items={sopItems}
            canEdit={true}
            uploadedBy={uploadedBy}
            onSave={async (items) => setSopItems(items)}
          />
          <DocumentBox
            title="Site Layout"
            subtitle="PDF, images, or Excel · up to 10 files"
            items={layoutItems}
            canEdit={true}
            uploadedBy={uploadedBy}
            onSave={async (items) => setLayoutItems(items)}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Creating…" : "Create Project"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>

      <p className="text-xs text-zinc-500">
        New projects include the full home automation workflow template. You can
        modify all details later from the project page.
      </p>
    </form>
  );
}
