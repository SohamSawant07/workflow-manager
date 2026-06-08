"use client";

import { useState } from "react";
import type { Project, ProjectStatus } from "@/types";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { updateProject } from "@/lib/firestore/projects";
import { PROJECT_STATUSES } from "@/lib/constants";
import { useAuthContext } from "@/components/providers/AuthProvider";
import { canEditProject } from "@/lib/auth/permissions";
import { isOverdue } from "@/lib/utils/dates";

interface SiteDetailsCardProps {
  project: Project;
}

export function SiteDetailsCard({ project }: SiteDetailsCardProps) {
  const { user } = useAuthContext();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Edit form states
  const [name, setName] = useState(project.name);
  const [clientName, setClientName] = useState(project.clientName);
  const [siteManagerName, setSiteManagerName] = useState(project.siteManagerName ?? "");
  const [deadline, setDeadline] = useState(project.deadline ? project.deadline.split("T")[0] : "");
  const [status, setStatus] = useState<string>(
    isOverdue(project.deadline, project.status) ? "overdue" : project.status
  );
  const [address, setAddress] = useState(project.address ?? "");
  const [city, setCity] = useState(project.city ?? "");
  const [landmark, setLandmark] = useState(project.landmark ?? "");
  const [googleMapsLink, setGoogleMapsLink] = useState(project.googleMapsLink ?? "");
  const [clientPhone, setClientPhone] = useState(project.clientPhone ?? "");
  const [startDate, setStartDate] = useState(project.startDate ? project.startDate.split("T")[0] : "");
  const [contacts, setContacts] = useState<{ designation: string; name: string; phone: string }[]>(
    project.siteContacts ?? []
  );

  const [prevProject, setPrevProject] = useState(project);

  if (project !== prevProject) {
    setPrevProject(project);
    setName(project.name);
    setClientName(project.clientName);
    setSiteManagerName(project.siteManagerName ?? "");
    setDeadline(project.deadline ? project.deadline.split("T")[0] : "");
    setStatus(isOverdue(project.deadline, project.status) ? "overdue" : project.status);
    setAddress(project.address ?? "");
    setCity(project.city ?? "");
    setLandmark(project.landmark ?? "");
    setGoogleMapsLink(project.googleMapsLink ?? "");
    setClientPhone(project.clientPhone ?? "");
    setStartDate(project.startDate ? project.startDate.split("T")[0] : "");
    setContacts(project.siteContacts ?? []);
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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

    // Validate allowed status transitions
    const initialDynamicStatus = isOverdue(project.deadline, project.status) ? "overdue" : project.status;
    const targetStatus = status;

    const allowedTransitions: Record<string, string[]> = {
      planning: ["planning", "in_progress", "completed"],
      in_progress: ["in_progress", "planning", "completed"],
      overdue: ["overdue", "in_progress", "completed"],
      completed: ["completed"],
    };

    const allowed = allowedTransitions[initialDynamicStatus]
      ? allowedTransitions[initialDynamicStatus].includes(targetStatus)
      : true; // fallback for other legacy statuses

    if (!allowed) {
      setError(`Transition from ${initialDynamicStatus} to ${targetStatus} is not allowed.`);
      setLoading(false);
      return;
    }

    try {
      const dbStatus = (status === "overdue" ? project.status : status) as ProjectStatus;
      await updateProject(project.id, {
        name,
        clientName,
        siteManagerName,
        deadline: deadline,
        status: dbStatus,
        address,
        city,
        landmark,
        googleMapsLink,
        clientPhone,
        startDate: startDate,
        siteContacts: contacts,
      });
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update project details");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setName(project.name);
    setClientName(project.clientName);
    setSiteManagerName(project.siteManagerName ?? "");
    setDeadline(project.deadline ? project.deadline.split("T")[0] : "");
    setStatus(isOverdue(project.deadline, project.status) ? "overdue" : project.status);
    setAddress(project.address ?? "");
    setCity(project.city ?? "");
    setLandmark(project.landmark ?? "");
    setGoogleMapsLink(project.googleMapsLink ?? "");
    setClientPhone(project.clientPhone ?? "");
    setStartDate(project.startDate ? project.startDate.split("T")[0] : "");
    setContacts(project.siteContacts ?? []);
    setError("");
    setIsEditing(false);
  };

  const isValidHttpUrl = (str: string) => {
    try {
      const url = new URL(str);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  };

  if (isEditing) {
    const isProjOverdue = isOverdue(project.deadline, project.status);
    const initialDynamicStatus = isProjOverdue ? "overdue" : project.status;

    let statusOptions: { value: string; label: string }[] = [];
    if (initialDynamicStatus === "planning") {
      statusOptions = [
        { value: "planning", label: "Planning" },
        { value: "in_progress", label: "In Progress" },
        { value: "completed", label: "Completed" },
      ];
    } else if (initialDynamicStatus === "in_progress") {
      statusOptions = [
        { value: "in_progress", label: "In Progress" },
        { value: "planning", label: "Planning" },
        { value: "completed", label: "Completed" },
      ];
    } else if (initialDynamicStatus === "overdue") {
      statusOptions = [
        { value: "overdue", label: "Overdue" },
        { value: "in_progress", label: "In Progress" },
        { value: "completed", label: "Completed" },
      ];
    } else if (initialDynamicStatus === "completed") {
      statusOptions = [
        { value: "completed", label: "Completed" },
      ];
    } else {
      statusOptions = PROJECT_STATUSES;
    }

    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm transition-all">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-md font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit Project & Site Details
          </h2>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Project Details
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input
                  label="Project Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="Client Name (optional)"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
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
              <div className="sm:col-span-2">
                <Input
                  label="Start Date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="Deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Select
                  label="Status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  options={statusOptions}
                />
              </div>
            </div>
          </div>

          <hr className="border-zinc-100 dark:border-zinc-800" />

          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Location & Site Details
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
                  placeholder="e.g. 123 Automation Way"
                />
              </div>
              <div>
                <Input
                  label="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. San Francisco"
                />
              </div>
              <div>
                <Input
                  label="Landmark"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. Near Transamerica Pyramid"
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

          <hr className="border-zinc-150 dark:border-zinc-800" />

          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Site Contacts
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
                      placeholder="e.g. Architect"
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

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save Details"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // Render view mode
  const hasSiteDetails = address || city || landmark || googleMapsLink || clientPhone;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm transition-all">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-md font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Site & Client Details
        </h2>
        {canEditProject(user, project) && (
          <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
            <span className="flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit Details
            </span>
          </Button>
        )}
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">Start Date: {project.startDate ? new Date(project.startDate).toLocaleDateString() : "—"}</p>

      {!hasSiteDetails ? (
        <div className="rounded-lg border border-dashed border-zinc-200 p-4 text-center dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No site details or contact numbers have been saved yet.
          </p>
          {canEditProject(user, project) && (
            <button
              onClick={() => setIsEditing(true)}
              className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              Add Details Now
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Column 1: Client phone & Location */}
          <div className="space-y-4">
            <div>
              <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Client Contact
              </span>
              <div className="mt-1 flex items-center gap-2">
                <svg className="h-4.5 w-4.5 text-zinc-400 dark:text-zinc-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h2.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.24.96l-1.35 1.35a11.047 11.047 0 004.8 4.8l1.35-1.35a1 1 0 01.96-.24l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {clientPhone ? (
                  <a
                    href={`tel:${clientPhone}`}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300 break-all"
                  >
                    {clientPhone}
                  </a>
                ) : (
                  <span className="text-sm text-zinc-400 dark:text-zinc-500 italic">
                    Not provided
                  </span>
                )}
              </div>
            </div>

            <div>
              <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Site Address
              </span>
              <div className="mt-1 flex items-start gap-2">
                <svg className="h-4.5 w-4.5 text-zinc-400 dark:text-zinc-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="text-sm text-zinc-700 dark:text-zinc-300 break-words font-medium">
                  {address || <span className="text-zinc-400 dark:text-zinc-500 italic font-normal">Not provided</span>}
                </span>
              </div>
            </div>
          </div>

          {/* Column 2: City, Landmark, Maps */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  City
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <svg className="h-4.5 w-4.5 text-zinc-400 dark:text-zinc-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2h2m0 0l.35 2.84A3 3 0 0020.2 16h1.4" />
                  </svg>
                  <span className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                    {city || <span className="text-zinc-400 dark:text-zinc-500 italic font-normal">Not provided</span>}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  Landmark
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <svg className="h-4.5 w-4.5 text-zinc-400 dark:text-zinc-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                  </svg>
                  <span className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                    {landmark || <span className="text-zinc-400 dark:text-zinc-500 italic font-normal">Not provided</span>}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Google Maps Location
              </span>
              <div className="mt-1 flex items-center gap-2">
                <svg className="h-4.5 w-4.5 text-zinc-400 dark:text-zinc-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                {googleMapsLink ? (
                  <a
                    href={isValidHttpUrl(googleMapsLink) ? googleMapsLink : `https://${googleMapsLink.replace(/^(https?:\/\/)?/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-indigo-600 hover:text-indigo-500 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300 inline-flex items-center gap-1"
                  >
                    Open Google Maps
                  </a>
                ) : (
                  <span className="text-sm text-zinc-400 dark:text-zinc-500 italic">
                    No map link provided
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Site Contacts Section */}
      <hr className="my-5 border-zinc-150 dark:border-zinc-800" />
      
      <div>
        <h3 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">
          Site Contacts
        </h3>
        
        {(!project.siteContacts || project.siteContacts.length === 0) ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500 italic">
            No site contacts added yet.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {project.siteContacts.map((contact, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950/20"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-block rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 uppercase tracking-wider">
                      {contact.designation}
                    </span>
                  </div>
                  {contact.name && (
                    <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {contact.name}
                    </h4>
                  )}
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold mt-0.5 break-all">
                    {contact.phone}
                  </p>
                </div>
                
                <a
                  href={`tel:${contact.phone}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 dark:hover:bg-indigo-950/60 flex-shrink-0"
                  title={contact.name ? `Call ${contact.name}` : `Call ${contact.designation}`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h2.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.24.96l-1.35 1.35a11.047 11.047 0 004.8 4.8l1.35-1.35a1 1 0 01.96-.24l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
