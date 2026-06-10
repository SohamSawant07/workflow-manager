"use client";

import { use } from "react";
import { useProject } from "@/hooks/useProject";
import { ProjectHeader } from "@/components/projects/ProjectHeader";
import { SiteDetailsCard } from "@/components/projects/SiteDetailsCard";
import { ClientAccessCard } from "@/components/projects/ClientAccessCard";
import { ProjectPhotos } from "@/components/projects/ProjectPhotos";
import { ProjectDocuments } from "@/components/projects/ProjectDocuments";
import { WorkflowTree } from "@/components/workflow/WorkflowTree";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectPage({ params }: ProjectPageProps) {
  const { id } = use(params);
  const { project, loading } = useProject(id);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!project) {
    return (
      <EmptyState
        title="Project not found"
        description="This project may have been deleted or you don't have access."
        action={
          <Link href="/dashboard">
            <Button variant="secondary">Back to Dashboard</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <ProjectHeader project={project} />
      <SiteDetailsCard project={project} />
      <ProjectDocuments project={project} />
      <ClientAccessCard project={project} />
      <ProjectPhotos projectId={project.id} project={project} />
      <div>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Workflow
        </h2>
        <WorkflowTree project={project} />
      </div>
    </div>
  );
}
