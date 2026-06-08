"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizeProjectFromFirestore } from "@/lib/project-defaults";
import type { Project } from "@/types";
import { ClientPortalView } from "@/components/client/ClientPortalView";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { normalizePhoneNumber } from "@/lib/utils/phone";

function ClientPortalContent() {
  const searchParams = useSearchParams();
  
  // Credentials input state
  const [accessCode, setAccessCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  
  // Session credentials state
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [sessionPhone, setSessionPhone] = useState<string | null>(null);

  // Authentication & session state
  const [authenticated, setAuthenticated] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [verifyingSession, setVerifyingSession] = useState(true);
  
  // Action states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Pre-fill access code from URL query parameter if provided
  useEffect(() => {
    const codeParam = searchParams.get("code");
    if (codeParam) {
      requestAnimationFrame(() => {
        setAccessCode(codeParam);
      });
    }
  }, [searchParams]);

  // Read credentials from sessionStorage on mount
  useEffect(() => {
    requestAnimationFrame(() => {
      setSessionCode(sessionStorage.getItem("clientAccessCode"));
      setSessionPhone(sessionStorage.getItem("clientPhone"));
    });
  }, []);

  // Listen to Firestore project updates in real-time when authenticated
  useEffect(() => {
    if (sessionCode && sessionPhone) {
      requestAnimationFrame(() => {
        setVerifyingSession(true);
      });
      const q = query(
        collection(db, "projects"),
        where("clientAccessCode", "==", sessionCode.trim()),
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const docSnap = snapshot.docs[0];
          const projectData = normalizeProjectFromFirestore(docSnap.id, docSnap.data());
          
          if (normalizePhoneNumber(projectData.clientPhone || "") === normalizePhoneNumber(sessionPhone)) {
            setProject(projectData);
            setAuthenticated(true);
          } else {
            handleLogout();
          }
        } else {
          // If project details or access code change in Firestore, sign the client out
          handleLogout();
        }
        setVerifyingSession(false);
      }, (err) => {
        console.error("Client portal snapshot error:", err);
        setVerifyingSession(false);
      });
      
      return () => unsubscribe();
    } else {
      requestAnimationFrame(() => {
        setProject(null);
        setAuthenticated(false);
        setVerifyingSession(false);
      });
    }
  }, [sessionCode, sessionPhone]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim() || !phoneNumber.trim()) {
      setError("Please fill out both fields.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const q = query(
        collection(db, "projects"),
        where("clientAccessCode", "==", accessCode.trim()),
      );

      const snapshot = await getDocs(q);
      console.log("Docs found:", snapshot.size);

      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const projectData = normalizeProjectFromFirestore(docSnap.id, docSnap.data());
        
        if (normalizePhoneNumber(projectData.clientPhone || "") === normalizePhoneNumber(phoneNumber)) {
          sessionStorage.setItem("clientAccessCode", accessCode.trim());
          sessionStorage.setItem("clientPhone", phoneNumber.trim());
          
          setSessionCode(accessCode.trim());
          setSessionPhone(phoneNumber.trim());
          setAuthenticated(true);
        } else {
          setError("Invalid access code or phone number");
        }
      } else {
        setError("Invalid access code or phone number");
      }
    } catch (err) {
      console.error("Login verification error:", err);
      setError("Invalid access code or phone number");
    } finally {
      setLoading(false);
    }
  };

  function handleLogout() {
    sessionStorage.removeItem("clientAccessCode");
    sessionStorage.removeItem("clientPhone");
    setSessionCode(null);
    setSessionPhone(null);
    setProject(null);
    setAuthenticated(false);
  }

  if (verifyingSession) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Spinner />
      </div>
    );
  }

  if (authenticated && project) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 md:p-6 lg:p-8">
        <ClientPortalView project={project} onLogout={handleLogout} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 transition-all">
        <div className="text-center">
          <span className="text-3xl">🔑</span>
          <h2 className="mt-4 text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">
            Client Portal Access
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Enter your access credentials to view your project updates.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            label="Client Access Code"
            type="text"
            placeholder="e.g. PRJ-4837"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            required
          />

          <Input
            label="Phone Number"
            type="tel"
            placeholder="e.g. +1 (555) 019-2834"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            required
          />

          {error && (
            <p className="text-sm font-semibold text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full justify-center">
            {loading ? "Verifying..." : "Access Project"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function ClientPortalPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Spinner />
      </div>
    }>
      <ClientPortalContent />
    </Suspense>
  );
}
