"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createProject,
  deleteProject,
  createCertification,
  deleteCertification,
} from "@/lib/actions/projects";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string;
  url?: string | null;
  technologies: string[];
}

interface Certification {
  id: string;
  name: string;
  issuing_organization: string;
  issue_date?: string | null;
  expiry_date?: string | null;
  credential_url?: string | null;
}

interface ProjectsFormProps {
  initialProjects: Project[];
  initialCertifications: Certification[];
  hasParsedData: boolean;
  parsedProjects: Array<Record<string, unknown>>;
  parsedCertifications: Array<Record<string, unknown>>;
}

export function ProjectsForm({
  initialProjects,
  initialCertifications,
  hasParsedData,
  parsedProjects,
  parsedCertifications,
}: ProjectsFormProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [certifications, setCertifications] =
    useState<Certification[]>(initialCertifications);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Project form
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    url: "",
    technologies: "",
  });

  // Certification form
  const [showCertForm, setShowCertForm] = useState(false);
  const [newCert, setNewCert] = useState({
    name: "",
    issuing_organization: "",
    issue_date: "",
    expiry_date: "",
    credential_url: "",
  });

  const [showImportPrompt, setShowImportPrompt] = useState(
    hasParsedData &&
      (parsedProjects.length > 0 || parsedCertifications.length > 0) &&
      initialProjects.length === 0 &&
      initialCertifications.length === 0
  );

  async function importParsed() {
    setSaving(true);
    setError(null);

    for (const p of parsedProjects) {
      const result = await createProject({
        name: (p.name as string) || "",
        description: (p.description as string) || "",
        url: (p.url as string) || undefined,
        technologies: (p.technologies as string[]) ?? [],
      });
      if (result.error) {
        setError(result.error);
        setSaving(false);
        return;
      }
    }

    for (const c of parsedCertifications) {
      const result = await createCertification({
        name: (c.name as string) || "",
        issuing_organization: (c.issuing_organization as string) || "",
        issue_date: (c.issue_date as string) || undefined,
        expiry_date: (c.expiry_date as string) || undefined,
        credential_url: (c.credential_url as string) || undefined,
      });
      if (result.error) {
        setError(result.error);
        setSaving(false);
        return;
      }
    }

    setShowImportPrompt(false);
    setSaving(false);
    router.refresh();
  }

  async function handleAddProject() {
    setError(null);
    if (!newProject.name.trim() || !newProject.description.trim()) {
      setError("Project name and description are required.");
      return;
    }
    setSaving(true);
    const result = await createProject({
      name: newProject.name,
      description: newProject.description,
      url: newProject.url || undefined,
      technologies: newProject.technologies
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.data) {
      setProjects((prev) => [...prev, result.data!]);
    }
    setNewProject({ name: "", description: "", url: "", technologies: "" });
    setShowProjectForm(false);
  }

  async function handleDeleteProject(id: string) {
    if (!confirm("Remove this project?")) return;
    const result = await deleteProject(id);
    if (result.error) {
      setError(result.error);
      return;
    }
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleAddCert() {
    setError(null);
    if (!newCert.name.trim() || !newCert.issuing_organization.trim()) {
      setError("Certification name and issuing organization are required.");
      return;
    }
    setSaving(true);
    const result = await createCertification({
      name: newCert.name,
      issuing_organization: newCert.issuing_organization,
      issue_date: newCert.issue_date || undefined,
      expiry_date: newCert.expiry_date || undefined,
      credential_url: newCert.credential_url || undefined,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.data) {
      setCertifications((prev) => [...prev, result.data!]);
    }
    setNewCert({
      name: "",
      issuing_organization: "",
      issue_date: "",
      expiry_date: "",
      credential_url: "",
    });
    setShowCertForm(false);
  }

  async function handleDeleteCert(id: string) {
    if (!confirm("Remove this certification?")) return;
    const result = await deleteCertification(id);
    if (result.error) {
      setError(result.error);
      return;
    }
    setCertifications((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--w-text-primary)]">
          Projects & Certifications
        </h1>
        <p className="mt-2 text-sm text-[var(--w-text-secondary)]">
          Optional. Add notable projects and professional certifications.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-[var(--w-error-bg)] px-3 py-2 text-sm text-[var(--w-error)]">
          {error}
        </div>
      )}

      {showImportPrompt && (
        <Card className="mb-6 border-[var(--w-accent)]">
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-sm font-medium">
                Found items from your resume
              </p>
              <p className="text-xs text-[var(--w-text-muted)]">
                {parsedProjects.length} project
                {parsedProjects.length !== 1 ? "s" : ""}
                {parsedCertifications.length > 0 &&
                  `, ${parsedCertifications.length} certification${parsedCertifications.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowImportPrompt(false)}
              >
                Skip
              </Button>
              <Button size="sm" onClick={importParsed} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="projects">
        <TabsList className="mb-4">
          <TabsTrigger value="projects">
            Projects ({projects.length})
          </TabsTrigger>
          <TabsTrigger value="certifications">
            Certifications ({certifications.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="projects">
          <div className="grid gap-4">
            {projects.map((project) => (
              <Card key={project.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">
                        {project.name}
                      </p>
                      <p className="text-xs text-[var(--w-text-muted)]">
                        {project.description.slice(0, 100)}
                        {project.description.length > 100 ? "..." : ""}
                      </p>
                      {project.technologies.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {project.technologies.map((tech) => (
                            <Badge
                              key={tech}
                              variant="outline"
                              className="text-xs"
                            >
                              {tech}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[var(--w-text-muted)] hover:text-[var(--w-error)]"
                      onClick={() => handleDeleteProject(project.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>

          {showProjectForm ? (
            <Card className="mt-4">
              <CardContent className="grid gap-4 pt-6">
                <div className="grid gap-2">
                  <Label>Project Name *</Label>
                  <Input
                    value={newProject.name}
                    onChange={(e) =>
                      setNewProject((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="My Open Source Project"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Description *</Label>
                  <Textarea
                    value={newProject.description}
                    onChange={(e) =>
                      setNewProject((p) => ({
                        ...p,
                        description: e.target.value,
                      }))
                    }
                    placeholder="What did you build and why?"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>URL (optional)</Label>
                    <Input
                      value={newProject.url}
                      onChange={(e) =>
                        setNewProject((p) => ({ ...p, url: e.target.value }))
                      }
                      placeholder="https://github.com/..."
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Technologies (comma-separated)</Label>
                    <Input
                      value={newProject.technologies}
                      onChange={(e) =>
                        setNewProject((p) => ({
                          ...p,
                          technologies: e.target.value,
                        }))
                      }
                      placeholder="React, Node.js, PostgreSQL"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddProject} disabled={saving}>
                    {saving && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Project
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowProjectForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setShowProjectForm(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Project
            </Button>
          )}
        </TabsContent>

        <TabsContent value="certifications">
          <div className="grid gap-4">
            {certifications.map((cert) => (
              <Card key={cert.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{cert.name}</p>
                      <p className="text-xs text-[var(--w-text-muted)]">
                        {cert.issuing_organization}
                        {cert.issue_date ? ` | ${cert.issue_date}` : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[var(--w-text-muted)] hover:text-[var(--w-error)]"
                      onClick={() => handleDeleteCert(cert.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>

          {showCertForm ? (
            <Card className="mt-4">
              <CardContent className="grid gap-4 pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Certification Name *</Label>
                    <Input
                      value={newCert.name}
                      onChange={(e) =>
                        setNewCert((p) => ({ ...p, name: e.target.value }))
                      }
                      placeholder="AWS Solutions Architect"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Issuing Organization *</Label>
                    <Input
                      value={newCert.issuing_organization}
                      onChange={(e) =>
                        setNewCert((p) => ({
                          ...p,
                          issuing_organization: e.target.value,
                        }))
                      }
                      placeholder="Amazon Web Services"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Issue Date</Label>
                    <Input
                      type="date"
                      value={newCert.issue_date}
                      onChange={(e) =>
                        setNewCert((p) => ({
                          ...p,
                          issue_date: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Credential URL (optional)</Label>
                    <Input
                      value={newCert.credential_url}
                      onChange={(e) =>
                        setNewCert((p) => ({
                          ...p,
                          credential_url: e.target.value,
                        }))
                      }
                      placeholder="https://verify.credential.com/..."
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddCert} disabled={saving}>
                    {saving && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Certification
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowCertForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setShowCertForm(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Certification
            </Button>
          )}
        </TabsContent>
      </Tabs>

      <div className="mt-auto flex items-center justify-between pt-8">
        <Button
          variant="outline"
          onClick={() => router.push("/onboarding/skills")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={() => router.push("/onboarding/preferences")}>
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
