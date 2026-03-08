"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { getProfile, updateBasicInfo, updateHeadline } from "@/lib/actions/profile";
import {
  getWorkExperiences,
  createWorkExperience,
  updateWorkExperience,
  deleteWorkExperience,
} from "@/lib/actions/work-experience";
import {
  createAchievement,
  updateAchievement,
  deleteAchievement,
} from "@/lib/actions/achievement";
import {
  getEducation,
  createEducation,
  updateEducation,
  deleteEducation,
} from "@/lib/actions/education";
import {
  getSkills,
  createSkill,
  updateSkill,
  deleteSkill,
} from "@/lib/actions/skills";
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  getCertifications,
  createCertification,
  updateCertification,
  deleteCertification,
} from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  Save,
  X,
  Loader2,
  Sparkles,
  User,
  Briefcase,
  GraduationCap,
  Code,
  Award,
  FileText,
  Check,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface Profile {
  full_name: string;
  phone: string | null;
  country: string | null;
  location: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  github_url: string | null;
  headline: string | null;
  summary: string | null;
}

interface WorkExp {
  id: string;
  company_name: string;
  job_title: string;
  location: string | null;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  achievements: Achievement[];
}

interface Achievement {
  id: string;
  description: string;
  metrics: string | null;
  skills: string[] | null;
}

interface Education {
  id: string;
  institution: string;
  degree: string | null;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
  gpa: string | null;
  achievements: string[] | null;
}

interface Skill {
  id: string;
  name: string;
  category: string;
  proficiency: string | null;
  years_experience: number | null;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  url: string | null;
  technologies: string[] | null;
  start_date: string | null;
  end_date: string | null;
  highlights: string[] | null;
}

interface Certification {
  id: string;
  name: string;
  issuing_organization: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  credential_url: string | null;
}

/* ------------------------------------------------------------------ */
/*  Collapsible Section                                                 */
/* ------------------------------------------------------------------ */

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  onAdd,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  onAdd?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-[var(--w-border)] bg-[var(--w-surface)] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-5 py-4 text-left hover:bg-[var(--w-surface-alt)]/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="h-4.5 w-4.5 text-[var(--w-primary)]" />
          <span className="text-sm font-semibold text-[var(--w-text-primary)]">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onAdd && open && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          )}
          {open ? (
            <ChevronDown className="h-4 w-4 text-[var(--w-text-muted)]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[var(--w-text-muted)]" />
          )}
        </div>
      </button>
      {open && <div className="px-5 pb-5 border-t border-[var(--w-border)]">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Field Display                                                       */
/* ------------------------------------------------------------------ */

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium text-[var(--w-text-muted)] uppercase tracking-wider">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-[var(--w-text-primary)]">
        {value || <span className="text-[var(--w-text-muted)] italic">Not set</span>}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading Skeleton                                                    */
/* ------------------------------------------------------------------ */

function ProfileSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-[var(--w-border)] bg-[var(--w-surface)] p-5 h-16"
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                           */
/* ------------------------------------------------------------------ */

export default function SettingsProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workExps, setWorkExps] = useState<WorkExp[]>([]);
  const [education, setEducation] = useState<Education[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [certs, setCerts] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit states
  const [editingBasic, setEditingBasic] = useState(false);
  const [editingHeadline, setEditingHeadline] = useState(false);
  const [editingWorkExpId, setEditingWorkExpId] = useState<string | null>(null);
  const [addingWorkExp, setAddingWorkExp] = useState(false);
  const [editingEduId, setEditingEduId] = useState<string | null>(null);
  const [addingEdu, setAddingEdu] = useState(false);
  const [addingSkill, setAddingSkill] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [addingProject, setAddingProject] = useState(false);
  const [editingCertId, setEditingCertId] = useState<string | null>(null);
  const [addingCert, setAddingCert] = useState(false);
  const [savePending, startSaveTransition] = useTransition();

  // Form states for basic info
  const [basicForm, setBasicForm] = useState({
    full_name: "",
    phone: "",
    country: "",
    location: "",
    linkedin_url: "",
    portfolio_url: "",
    github_url: "",
  });

  // Form states for headline
  const [headlineForm, setHeadlineForm] = useState({
    headline: "",
    summary: "",
  });

  // Inline form states
  const [workExpForm, setWorkExpForm] = useState({
    company_name: "",
    job_title: "",
    location: "",
    country: "",
    start_date: "",
    end_date: "",
    is_current: false,
    description: "",
  });

  const [eduForm, setEduForm] = useState({
    institution: "",
    degree: "",
    field_of_study: "",
    start_date: "",
    end_date: "",
    gpa: "",
  });

  const [skillForm, setSkillForm] = useState({
    name: "",
    category: "technical",
    proficiency: "",
    years_experience: "",
  });

  const [projectForm, setProjectForm] = useState({
    name: "",
    description: "",
    url: "",
    technologies: "",
    start_date: "",
    end_date: "",
  });

  const [certForm, setCertForm] = useState({
    name: "",
    issuing_organization: "",
    issue_date: "",
    expiry_date: "",
    credential_url: "",
  });

  useEffect(() => {
    async function load() {
      const [p, w, ed, sk, pr, ce] = await Promise.all([
        getProfile(),
        getWorkExperiences(),
        getEducation(),
        getSkills(),
        getProjects(),
        getCertifications(),
      ]);
      if (p) {
        setProfile(p as unknown as Profile);
        setBasicForm({
          full_name: p.full_name ?? "",
          phone: p.phone ?? "",
          country: p.country ?? "",
          location: p.location ?? "",
          linkedin_url: p.linkedin_url ?? "",
          portfolio_url: p.portfolio_url ?? "",
          github_url: p.github_url ?? "",
        });
        setHeadlineForm({
          headline: p.headline ?? "",
          summary: p.summary ?? "",
        });
      }
      setWorkExps((w ?? []) as WorkExp[]);
      setEducation((ed ?? []) as Education[]);
      setSkills((sk ?? []) as Skill[]);
      setProjects((pr ?? []) as Project[]);
      setCerts((ce ?? []) as Certification[]);
      setLoading(false);
    }
    load();
  }, []);

  /* ---- Basic Info ---- */
  function handleSaveBasic() {
    startSaveTransition(async () => {
      const result = await updateBasicInfo(basicForm);
      if ("error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Basic info updated");
        setProfile((p) => (p ? { ...p, ...basicForm } : p));
        setEditingBasic(false);
      }
    });
  }

  /* ---- Headline / Summary ---- */
  function handleSaveHeadline() {
    startSaveTransition(async () => {
      const result = await updateHeadline(headlineForm);
      if ("error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Professional summary updated");
        setProfile((p) =>
          p
            ? {
                ...p,
                headline: headlineForm.headline || null,
                summary: headlineForm.summary || null,
              }
            : p
        );
        setEditingHeadline(false);
      }
    });
  }

  async function handleAiSummary() {
    toast.info("Generating summary...");
    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke(
        "ai-assist",
        { body: { action: "generate_summary" } }
      );
      if (fnError || data?.error) {
        toast.error(data?.error ?? fnError?.message ?? "AI generation failed");
      } else if (data?.summary) {
        setHeadlineForm((f) => ({ ...f, summary: data.summary }));
        toast.success("Summary generated — review and save");
      }
    } catch {
      toast.error("Failed to generate summary");
    }
  }

  /* ---- Work Experience CRUD ---- */
  function resetWorkExpForm() {
    setWorkExpForm({
      company_name: "",
      job_title: "",
      location: "",
      country: "",
      start_date: "",
      end_date: "",
      is_current: false,
      description: "",
    });
  }

  function startEditWorkExp(w: WorkExp) {
    setEditingWorkExpId(w.id);
    setWorkExpForm({
      company_name: w.company_name,
      job_title: w.job_title,
      location: w.location ?? "",
      country: w.country ?? "",
      start_date: w.start_date ?? "",
      end_date: w.end_date ?? "",
      is_current: w.is_current,
      description: w.description ?? "",
    });
  }

  function handleSaveWorkExp() {
    startSaveTransition(async () => {
      if (editingWorkExpId) {
        const result = await updateWorkExperience(editingWorkExpId, {
          company_name: workExpForm.company_name,
          job_title: workExpForm.job_title,
          location: workExpForm.location || undefined,
          country: workExpForm.country || undefined,
          start_date: workExpForm.start_date || undefined,
          end_date: workExpForm.end_date || undefined,
          is_current: workExpForm.is_current,
          description: workExpForm.description || undefined,
        });
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Work experience updated");
          setWorkExps((prev) =>
            prev.map((w) =>
              w.id === editingWorkExpId
                ? {
                    ...w,
                    ...workExpForm,
                    location: workExpForm.location || null,
                    country: workExpForm.country || null,
                    start_date: workExpForm.start_date || null,
                    end_date: workExpForm.end_date || null,
                    description: workExpForm.description || null,
                  }
                : w
            )
          );
          setEditingWorkExpId(null);
          resetWorkExpForm();
        }
      } else {
        if (!workExpForm.company_name.trim() || !workExpForm.job_title.trim()) {
          toast.error("Company and job title are required");
          return;
        }
        const result = await createWorkExperience({
          company_name: workExpForm.company_name,
          job_title: workExpForm.job_title,
          location: workExpForm.location || undefined,
          country: workExpForm.country || undefined,
          start_date: workExpForm.start_date || "",
          end_date: workExpForm.end_date || undefined,
          is_current: workExpForm.is_current,
          description: workExpForm.description || undefined,
        });
        if (result.error) {
          toast.error(result.error);
        } else if (result.data) {
          toast.success("Work experience added");
          setWorkExps((prev) => [
            ...prev,
            { ...(result.data as unknown as WorkExp), achievements: [] },
          ]);
          setAddingWorkExp(false);
          resetWorkExpForm();
        }
      }
    });
  }

  async function handleDeleteWorkExp(id: string) {
    const result = await deleteWorkExperience(id);
    if ("error" in result && result.error) {
      toast.error(result.error);
    } else {
      setWorkExps((prev) => prev.filter((w) => w.id !== id));
      toast.success("Work experience deleted");
    }
  }

  async function handleImproveAchievement(achievementId: string, description: string) {
    toast.info("Improving achievement...");
    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke(
        "ai-assist",
        {
          body: {
            action: "improve_achievement",
            achievement_id: achievementId,
            original_text: description,
          },
        }
      );
      if (fnError || data?.error) {
        toast.error(data?.error ?? fnError?.message ?? "AI assist failed");
      } else if (data?.improved_text) {
        const updateResult = await updateAchievement(achievementId, {
          description: data.improved_text,
        });
        if (updateResult.error) {
          toast.error(updateResult.error);
        } else {
          setWorkExps((prev) =>
            prev.map((w) => ({
              ...w,
              achievements: w.achievements.map((a) =>
                a.id === achievementId
                  ? { ...a, description: data.improved_text }
                  : a
              ),
            }))
          );
          toast.success("Achievement improved");
        }
      }
    } catch {
      toast.error("Failed to improve achievement");
    }
  }

  /* ---- Education CRUD ---- */
  function resetEduForm() {
    setEduForm({
      institution: "",
      degree: "",
      field_of_study: "",
      start_date: "",
      end_date: "",
      gpa: "",
    });
  }

  function startEditEdu(ed: Education) {
    setEditingEduId(ed.id);
    setEduForm({
      institution: ed.institution,
      degree: ed.degree ?? "",
      field_of_study: ed.field_of_study ?? "",
      start_date: ed.start_date ?? "",
      end_date: ed.end_date ?? "",
      gpa: ed.gpa ?? "",
    });
  }

  function handleSaveEdu() {
    startSaveTransition(async () => {
      if (editingEduId) {
        const result = await updateEducation(editingEduId, {
          institution: eduForm.institution,
          degree: eduForm.degree || undefined,
          field_of_study: eduForm.field_of_study || undefined,
          start_date: eduForm.start_date || undefined,
          end_date: eduForm.end_date || undefined,
          gpa: eduForm.gpa ? parseFloat(eduForm.gpa) : null,
        });
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Education updated");
          setEducation((prev) =>
            prev.map((e) =>
              e.id === editingEduId
                ? {
                    ...e,
                    institution: eduForm.institution,
                    degree: eduForm.degree || null,
                    field_of_study: eduForm.field_of_study || null,
                    start_date: eduForm.start_date || null,
                    end_date: eduForm.end_date || null,
                    gpa: eduForm.gpa || null,
                  }
                : e
            )
          );
          setEditingEduId(null);
          resetEduForm();
        }
      } else {
        if (!eduForm.institution.trim()) {
          toast.error("Institution is required");
          return;
        }
        const result = await createEducation({
          institution: eduForm.institution,
          degree: eduForm.degree || "",
          field_of_study: eduForm.field_of_study || "",
          start_date: eduForm.start_date || undefined,
          end_date: eduForm.end_date || undefined,
          gpa: eduForm.gpa ? parseFloat(eduForm.gpa) : undefined,
        });
        if (result.error) {
          toast.error(result.error);
        } else if (result.data) {
          toast.success("Education added");
          setEducation((prev) => [...prev, result.data as unknown as Education]);
          setAddingEdu(false);
          resetEduForm();
        }
      }
    });
  }

  async function handleDeleteEdu(id: string) {
    const result = await deleteEducation(id);
    if ("error" in result && result.error) {
      toast.error(result.error);
    } else {
      setEducation((prev) => prev.filter((e) => e.id !== id));
      toast.success("Education deleted");
    }
  }

  /* ---- Skills CRUD ---- */
  function resetSkillForm() {
    setSkillForm({ name: "", category: "technical", proficiency: "", years_experience: "" });
  }

  function handleSaveSkill() {
    startSaveTransition(async () => {
      if (!skillForm.name.trim()) {
        toast.error("Skill name is required");
        return;
      }
      const result = await createSkill({
        name: skillForm.name,
        category: skillForm.category,
        proficiency: skillForm.proficiency || undefined,
        years_experience: skillForm.years_experience
          ? parseInt(skillForm.years_experience)
          : undefined,
      });
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        toast.success("Skill added");
        setSkills((prev) => [...prev, result.data as unknown as Skill]);
        setAddingSkill(false);
        resetSkillForm();
      }
    });
  }

  async function handleDeleteSkill(id: string) {
    const result = await deleteSkill(id);
    if ("error" in result && result.error) {
      toast.error(result.error);
    } else {
      setSkills((prev) => prev.filter((s) => s.id !== id));
      toast.success("Skill deleted");
    }
  }

  async function handleSuggestSkills() {
    toast.info("Suggesting skills...");
    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke(
        "ai-assist",
        { body: { action: "suggest_skills" } }
      );
      if (fnError || data?.error) {
        toast.error(data?.error ?? fnError?.message ?? "AI assist failed");
      } else if (data?.skills && Array.isArray(data.skills)) {
        for (const s of data.skills) {
          const result = await createSkill({
            name: s.name,
            category: s.category ?? "technical",
            proficiency: s.proficiency ?? undefined,
            years_experience: undefined,
          });
          if (result.data) {
            setSkills((prev) => [...prev, result.data as unknown as Skill]);
          }
        }
        toast.success(`${data.skills.length} skills suggested and added`);
      }
    } catch {
      toast.error("Failed to suggest skills");
    }
  }

  /* ---- Projects CRUD ---- */
  function resetProjectForm() {
    setProjectForm({
      name: "",
      description: "",
      url: "",
      technologies: "",
      start_date: "",
      end_date: "",
    });
  }

  function startEditProject(p: Project) {
    setEditingProjectId(p.id);
    setProjectForm({
      name: p.name,
      description: p.description ?? "",
      url: p.url ?? "",
      technologies: p.technologies?.join(", ") ?? "",
      start_date: p.start_date ?? "",
      end_date: p.end_date ?? "",
    });
  }

  function handleSaveProject() {
    startSaveTransition(async () => {
      const techs = projectForm.technologies
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      if (editingProjectId) {
        const result = await updateProject(editingProjectId, {
          name: projectForm.name,
          description: projectForm.description || undefined,
          url: projectForm.url || undefined,
          technologies: techs.length > 0 ? techs : undefined,
          start_date: projectForm.start_date || undefined,
          end_date: projectForm.end_date || undefined,
        });
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Project updated");
          setProjects((prev) =>
            prev.map((p) =>
              p.id === editingProjectId
                ? {
                    ...p,
                    name: projectForm.name,
                    description: projectForm.description || null,
                    url: projectForm.url || null,
                    technologies: techs.length > 0 ? techs : null,
                    start_date: projectForm.start_date || null,
                    end_date: projectForm.end_date || null,
                  }
                : p
            )
          );
          setEditingProjectId(null);
          resetProjectForm();
        }
      } else {
        if (!projectForm.name.trim()) {
          toast.error("Project name is required");
          return;
        }
        const result = await createProject({
          name: projectForm.name,
          description: projectForm.description || "",
          url: projectForm.url || undefined,
          technologies: techs.length > 0 ? techs : undefined,
          start_date: projectForm.start_date || undefined,
          end_date: projectForm.end_date || undefined,
        });
        if (result.error) {
          toast.error(result.error);
        } else if (result.data) {
          toast.success("Project added");
          setProjects((prev) => [...prev, result.data as unknown as Project]);
          setAddingProject(false);
          resetProjectForm();
        }
      }
    });
  }

  async function handleDeleteProject(id: string) {
    const result = await deleteProject(id);
    if ("error" in result && result.error) {
      toast.error(result.error);
    } else {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      toast.success("Project deleted");
    }
  }

  /* ---- Certifications CRUD ---- */
  function resetCertForm() {
    setCertForm({
      name: "",
      issuing_organization: "",
      issue_date: "",
      expiry_date: "",
      credential_url: "",
    });
  }

  function startEditCert(c: Certification) {
    setEditingCertId(c.id);
    setCertForm({
      name: c.name,
      issuing_organization: c.issuing_organization ?? "",
      issue_date: c.issue_date ?? "",
      expiry_date: c.expiry_date ?? "",
      credential_url: c.credential_url ?? "",
    });
  }

  function handleSaveCert() {
    startSaveTransition(async () => {
      if (editingCertId) {
        const result = await updateCertification(editingCertId, {
          name: certForm.name,
          issuing_organization: certForm.issuing_organization || undefined,
          issue_date: certForm.issue_date || undefined,
          expiry_date: certForm.expiry_date || undefined,
          credential_url: certForm.credential_url || undefined,
        });
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Certification updated");
          setCerts((prev) =>
            prev.map((c) =>
              c.id === editingCertId
                ? {
                    ...c,
                    name: certForm.name,
                    issuing_organization: certForm.issuing_organization || null,
                    issue_date: certForm.issue_date || null,
                    expiry_date: certForm.expiry_date || null,
                    credential_url: certForm.credential_url || null,
                  }
                : c
            )
          );
          setEditingCertId(null);
          resetCertForm();
        }
      } else {
        if (!certForm.name.trim()) {
          toast.error("Certification name is required");
          return;
        }
        const result = await createCertification({
          name: certForm.name,
          issuing_organization: certForm.issuing_organization || "",
          issue_date: certForm.issue_date || undefined,
          expiry_date: certForm.expiry_date || undefined,
          credential_url: certForm.credential_url || undefined,
        });
        if (result.error) {
          toast.error(result.error);
        } else if (result.data) {
          toast.success("Certification added");
          setCerts((prev) => [...prev, result.data as unknown as Certification]);
          setAddingCert(false);
          resetCertForm();
        }
      }
    });
  }

  async function handleDeleteCert(id: string) {
    const result = await deleteCertification(id);
    if ("error" in result && result.error) {
      toast.error(result.error);
    } else {
      setCerts((prev) => prev.filter((c) => c.id !== id));
      toast.success("Certification deleted");
    }
  }

  /* ---- Inline form renderers ---- */

  function renderWorkExpForm(onCancel: () => void) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--w-border)] p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-[var(--w-text-secondary)]">Job Title *</label>
            <Input
              value={workExpForm.job_title}
              onChange={(e) => setWorkExpForm((f) => ({ ...f, job_title: e.target.value }))}
              className="mt-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--w-text-secondary)]">Company *</label>
            <Input
              value={workExpForm.company_name}
              onChange={(e) => setWorkExpForm((f) => ({ ...f, company_name: e.target.value }))}
              className="mt-1 text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-[var(--w-text-secondary)]">Location</label>
            <Input
              value={workExpForm.location}
              onChange={(e) => setWorkExpForm((f) => ({ ...f, location: e.target.value }))}
              className="mt-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--w-text-secondary)]">Country</label>
            <Input
              value={workExpForm.country}
              onChange={(e) => setWorkExpForm((f) => ({ ...f, country: e.target.value }))}
              className="mt-1 text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-[var(--w-text-secondary)]">Start Date</label>
            <Input
              type="date"
              value={workExpForm.start_date}
              onChange={(e) => setWorkExpForm((f) => ({ ...f, start_date: e.target.value }))}
              className="mt-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--w-text-secondary)]">End Date</label>
            <Input
              type="date"
              value={workExpForm.end_date}
              onChange={(e) => setWorkExpForm((f) => ({ ...f, end_date: e.target.value }))}
              disabled={workExpForm.is_current}
              className="mt-1 text-sm"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-[var(--w-text-secondary)]">
          <input
            type="checkbox"
            checked={workExpForm.is_current}
            onChange={(e) =>
              setWorkExpForm((f) => ({ ...f, is_current: e.target.checked, end_date: e.target.checked ? "" : f.end_date }))
            }
            className="rounded border-[var(--w-border)]"
          />
          Currently working here
        </label>
        <div>
          <label className="text-xs font-medium text-[var(--w-text-secondary)]">Description</label>
          <Textarea
            value={workExpForm.description}
            onChange={(e) => setWorkExpForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className="mt-1 text-sm"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="bg-[var(--w-primary)] text-white hover:bg-[var(--w-primary-light)]"
            onClick={handleSaveWorkExp}
            disabled={savePending}
          >
            {savePending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            Save
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X className="h-3.5 w-3.5 mr-1" /> Cancel
          </Button>
        </div>
      </div>
    );
  }

  function renderEduForm(onCancel: () => void) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--w-border)] p-4 space-y-3">
        <div>
          <label className="text-xs font-medium text-[var(--w-text-secondary)]">Institution *</label>
          <Input
            value={eduForm.institution}
            onChange={(e) => setEduForm((f) => ({ ...f, institution: e.target.value }))}
            className="mt-1 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-[var(--w-text-secondary)]">Degree</label>
            <Input
              value={eduForm.degree}
              onChange={(e) => setEduForm((f) => ({ ...f, degree: e.target.value }))}
              className="mt-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--w-text-secondary)]">Field of Study</label>
            <Input
              value={eduForm.field_of_study}
              onChange={(e) => setEduForm((f) => ({ ...f, field_of_study: e.target.value }))}
              className="mt-1 text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-[var(--w-text-secondary)]">Start Date</label>
            <Input
              type="date"
              value={eduForm.start_date}
              onChange={(e) => setEduForm((f) => ({ ...f, start_date: e.target.value }))}
              className="mt-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--w-text-secondary)]">End Date</label>
            <Input
              type="date"
              value={eduForm.end_date}
              onChange={(e) => setEduForm((f) => ({ ...f, end_date: e.target.value }))}
              className="mt-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--w-text-secondary)]">GPA</label>
            <Input
              value={eduForm.gpa}
              onChange={(e) => setEduForm((f) => ({ ...f, gpa: e.target.value }))}
              className="mt-1 text-sm"
              placeholder="e.g. 3.8"
            />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="bg-[var(--w-primary)] text-white hover:bg-[var(--w-primary-light)]"
            onClick={handleSaveEdu}
            disabled={savePending}
          >
            {savePending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            Save
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X className="h-3.5 w-3.5 mr-1" /> Cancel
          </Button>
        </div>
      </div>
    );
  }

  function renderProjectForm(onCancel: () => void) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--w-border)] p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-[var(--w-text-secondary)]">Name *</label>
            <Input
              value={projectForm.name}
              onChange={(e) => setProjectForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--w-text-secondary)]">URL</label>
            <Input
              value={projectForm.url}
              onChange={(e) => setProjectForm((f) => ({ ...f, url: e.target.value }))}
              className="mt-1 text-sm"
              placeholder="https://..."
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--w-text-secondary)]">Description</label>
          <Textarea
            value={projectForm.description}
            onChange={(e) => setProjectForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className="mt-1 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--w-text-secondary)]">Technologies (comma-separated)</label>
          <Input
            value={projectForm.technologies}
            onChange={(e) => setProjectForm((f) => ({ ...f, technologies: e.target.value }))}
            className="mt-1 text-sm"
            placeholder="React, TypeScript, Node.js"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-[var(--w-text-secondary)]">Start Date</label>
            <Input
              type="date"
              value={projectForm.start_date}
              onChange={(e) => setProjectForm((f) => ({ ...f, start_date: e.target.value }))}
              className="mt-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--w-text-secondary)]">End Date</label>
            <Input
              type="date"
              value={projectForm.end_date}
              onChange={(e) => setProjectForm((f) => ({ ...f, end_date: e.target.value }))}
              className="mt-1 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="bg-[var(--w-primary)] text-white hover:bg-[var(--w-primary-light)]"
            onClick={handleSaveProject}
            disabled={savePending}
          >
            {savePending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            Save
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X className="h-3.5 w-3.5 mr-1" /> Cancel
          </Button>
        </div>
      </div>
    );
  }

  function renderCertForm(onCancel: () => void) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--w-border)] p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-[var(--w-text-secondary)]">Name *</label>
            <Input
              value={certForm.name}
              onChange={(e) => setCertForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--w-text-secondary)]">Issuing Organization</label>
            <Input
              value={certForm.issuing_organization}
              onChange={(e) => setCertForm((f) => ({ ...f, issuing_organization: e.target.value }))}
              className="mt-1 text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-[var(--w-text-secondary)]">Issue Date</label>
            <Input
              type="date"
              value={certForm.issue_date}
              onChange={(e) => setCertForm((f) => ({ ...f, issue_date: e.target.value }))}
              className="mt-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--w-text-secondary)]">Expiry Date</label>
            <Input
              type="date"
              value={certForm.expiry_date}
              onChange={(e) => setCertForm((f) => ({ ...f, expiry_date: e.target.value }))}
              className="mt-1 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--w-text-secondary)]">Credential URL</label>
          <Input
            value={certForm.credential_url}
            onChange={(e) => setCertForm((f) => ({ ...f, credential_url: e.target.value }))}
            className="mt-1 text-sm"
            placeholder="https://..."
          />
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="bg-[var(--w-primary)] text-white hover:bg-[var(--w-primary-light)]"
            onClick={handleSaveCert}
            disabled={savePending}
          >
            {savePending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            Save
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X className="h-3.5 w-3.5 mr-1" /> Cancel
          </Button>
        </div>
      </div>
    );
  }

  /* ---- Render ---- */

  if (loading) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-[var(--w-text-primary)]">Profile</h1>
        <p className="mt-1 text-sm text-[var(--w-text-secondary)]">
          Manage your professional profile and knowledge base.
        </p>
        <div className="mt-8">
          <ProfileSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--w-text-primary)]">Profile</h1>
        <p className="mt-1 text-sm text-[var(--w-text-secondary)]">
          Manage your professional profile and knowledge base.
        </p>
      </div>

      {/* Basic Info */}
      <Section
        title="Basic Info"
        icon={User}
        defaultOpen
        onAdd={editingBasic ? undefined : () => setEditingBasic(true)}
      >
        {editingBasic ? (
          <div className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[var(--w-text-secondary)]">Full Name *</label>
                <Input
                  value={basicForm.full_name}
                  onChange={(e) => setBasicForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--w-text-secondary)]">Phone</label>
                <Input
                  value={basicForm.phone}
                  onChange={(e) => setBasicForm((f) => ({ ...f, phone: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[var(--w-text-secondary)]">Country</label>
                <Input
                  value={basicForm.country}
                  onChange={(e) => setBasicForm((f) => ({ ...f, country: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--w-text-secondary)]">City / Region</label>
                <Input
                  value={basicForm.location}
                  onChange={(e) => setBasicForm((f) => ({ ...f, location: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--w-text-secondary)]">LinkedIn URL</label>
              <Input
                value={basicForm.linkedin_url}
                onChange={(e) => setBasicForm((f) => ({ ...f, linkedin_url: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[var(--w-text-secondary)]">Portfolio URL</label>
                <Input
                  value={basicForm.portfolio_url}
                  onChange={(e) => setBasicForm((f) => ({ ...f, portfolio_url: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--w-text-secondary)]">GitHub URL</label>
                <Input
                  value={basicForm.github_url}
                  onChange={(e) => setBasicForm((f) => ({ ...f, github_url: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                className="bg-[var(--w-primary)] text-white hover:bg-[var(--w-primary-light)]"
                onClick={handleSaveBasic}
                disabled={savePending}
              >
                {savePending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingBasic(false);
                  setBasicForm({
                    full_name: profile?.full_name ?? "",
                    phone: profile?.phone ?? "",
                    country: profile?.country ?? "",
                    location: profile?.location ?? "",
                    linkedin_url: profile?.linkedin_url ?? "",
                    portfolio_url: profile?.portfolio_url ?? "",
                    github_url: profile?.github_url ?? "",
                  });
                }}
              >
                <X className="h-3.5 w-3.5 mr-1" /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 pt-4">
            <Field label="Full Name" value={profile?.full_name} />
            <Field label="Phone" value={profile?.phone} />
            <Field label="Country" value={profile?.country} />
            <Field label="City / Region" value={profile?.location} />
            <Field label="LinkedIn" value={profile?.linkedin_url} />
            <Field label="Portfolio" value={profile?.portfolio_url} />
            <Field label="GitHub" value={profile?.github_url} />
          </dl>
        )}
      </Section>

      {/* Professional Summary */}
      <Section
        title="Professional Summary"
        icon={FileText}
        onAdd={editingHeadline ? undefined : () => setEditingHeadline(true)}
      >
        {editingHeadline ? (
          <div className="space-y-3 pt-4">
            <div>
              <label className="text-xs font-medium text-[var(--w-text-secondary)]">Headline</label>
              <Input
                value={headlineForm.headline}
                onChange={(e) => setHeadlineForm((f) => ({ ...f, headline: e.target.value }))}
                placeholder="e.g. Senior Full-Stack Engineer"
                className="mt-1"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[var(--w-text-secondary)]">Summary</label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-[var(--w-primary)]"
                  onClick={handleAiSummary}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI Generate
                </Button>
              </div>
              <Textarea
                value={headlineForm.summary}
                onChange={(e) => setHeadlineForm((f) => ({ ...f, summary: e.target.value }))}
                rows={4}
                className="mt-1 text-sm"
                placeholder="Professional summary..."
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                className="bg-[var(--w-primary)] text-white hover:bg-[var(--w-primary-light)]"
                onClick={handleSaveHeadline}
                disabled={savePending}
              >
                {savePending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingHeadline(false);
                  setHeadlineForm({
                    headline: profile?.headline ?? "",
                    summary: profile?.summary ?? "",
                  });
                }}
              >
                <X className="h-3.5 w-3.5 mr-1" /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <dl className="space-y-3 pt-4">
            <Field label="Headline" value={profile?.headline} />
            <Field label="Summary" value={profile?.summary} />
          </dl>
        )}
      </Section>

      {/* Work Experience */}
      <Section
        title="Work Experience"
        icon={Briefcase}
        defaultOpen
        onAdd={() => {
          setAddingWorkExp(true);
          resetWorkExpForm();
        }}
      >
        <div className="space-y-3 pt-4">
          {addingWorkExp &&
            renderWorkExpForm(() => {
              setAddingWorkExp(false);
              resetWorkExpForm();
            })}

          {workExps.length === 0 && !addingWorkExp ? (
            <p className="text-sm text-[var(--w-text-muted)] italic">
              No work experience added yet.
            </p>
          ) : (
            workExps.map((w) =>
              editingWorkExpId === w.id ? (
                <div key={w.id}>
                  {renderWorkExpForm(() => {
                    setEditingWorkExpId(null);
                    resetWorkExpForm();
                  })}
                </div>
              ) : (
                <div key={w.id} className="rounded-lg border border-[var(--w-border)] p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--w-text-primary)]">
                        {w.job_title}
                      </p>
                      <p className="text-sm text-[var(--w-text-secondary)]">
                        {w.company_name}
                        {w.location ? ` — ${w.location}` : ""}
                      </p>
                      <p className="text-xs text-[var(--w-text-muted)] mt-0.5">
                        {w.start_date ?? "?"} — {w.is_current ? "Present" : (w.end_date ?? "?")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-[var(--w-text-muted)] hover:text-[var(--w-primary)]"
                        onClick={() => startEditWorkExp(w)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-[var(--w-text-muted)] hover:text-[var(--w-error)]"
                        onClick={() => handleDeleteWorkExp(w.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {w.achievements.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {w.achievements.map((a) => (
                        <li
                          key={a.id}
                          className="text-xs text-[var(--w-text-secondary)] flex items-start gap-1.5 group"
                        >
                          <span className="text-[var(--w-text-muted)] mt-0.5">•</span>
                          <span className="flex-1">{a.description}</span>
                          <button
                            onClick={() =>
                              handleImproveAchievement(a.id, a.description)
                            }
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--w-primary)] hover:text-[var(--w-primary-light)] shrink-0"
                            title="AI Improve"
                          >
                            <Sparkles className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            )
          )}
        </div>
      </Section>

      {/* Education */}
      <Section
        title="Education"
        icon={GraduationCap}
        onAdd={() => {
          setAddingEdu(true);
          resetEduForm();
        }}
      >
        <div className="space-y-3 pt-4">
          {addingEdu &&
            renderEduForm(() => {
              setAddingEdu(false);
              resetEduForm();
            })}

          {education.length === 0 && !addingEdu ? (
            <p className="text-sm text-[var(--w-text-muted)] italic">
              No education added yet.
            </p>
          ) : (
            education.map((ed) =>
              editingEduId === ed.id ? (
                <div key={ed.id}>
                  {renderEduForm(() => {
                    setEditingEduId(null);
                    resetEduForm();
                  })}
                </div>
              ) : (
                <div key={ed.id} className="rounded-lg border border-[var(--w-border)] p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--w-text-primary)]">
                        {ed.degree ? `${ed.degree} in ${ed.field_of_study ?? ""}` : ed.institution}
                      </p>
                      <p className="text-sm text-[var(--w-text-secondary)]">{ed.institution}</p>
                      <p className="text-xs text-[var(--w-text-muted)] mt-0.5">
                        {ed.start_date ?? "?"} — {ed.end_date ?? "Present"}
                        {ed.gpa ? ` · GPA: ${ed.gpa}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-[var(--w-text-muted)] hover:text-[var(--w-primary)]"
                        onClick={() => startEditEdu(ed)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-[var(--w-text-muted)] hover:text-[var(--w-error)]"
                        onClick={() => handleDeleteEdu(ed.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            )
          )}
        </div>
      </Section>

      {/* Skills */}
      <Section
        title="Skills"
        icon={Code}
        onAdd={() => {
          setAddingSkill(true);
          resetSkillForm();
        }}
      >
        <div className="pt-4 space-y-3">
          <div className="flex items-center justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-[var(--w-primary)]"
              onClick={handleSuggestSkills}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              AI Suggest Skills
            </Button>
          </div>

          {addingSkill && (
            <div className="rounded-lg border border-dashed border-[var(--w-border)] p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[var(--w-text-secondary)]">Skill Name *</label>
                  <Input
                    value={skillForm.name}
                    onChange={(e) => setSkillForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-1 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--w-text-secondary)]">Category</label>
                  <select
                    value={skillForm.category}
                    onChange={(e) => setSkillForm((f) => ({ ...f, category: e.target.value }))}
                    className="mt-1 w-full h-9 rounded-[var(--radius-sm)] border border-[var(--w-border)] bg-[var(--w-surface)] px-3 text-sm"
                  >
                    <option value="technical">Technical</option>
                    <option value="soft">Soft</option>
                    <option value="language">Language</option>
                    <option value="tool">Tool</option>
                    <option value="framework">Framework</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[var(--w-text-secondary)]">Proficiency</label>
                  <select
                    value={skillForm.proficiency}
                    onChange={(e) => setSkillForm((f) => ({ ...f, proficiency: e.target.value }))}
                    className="mt-1 w-full h-9 rounded-[var(--radius-sm)] border border-[var(--w-border)] bg-[var(--w-surface)] px-3 text-sm"
                  >
                    <option value="">Not specified</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--w-text-secondary)]">Years Experience</label>
                  <Input
                    type="number"
                    value={skillForm.years_experience}
                    onChange={(e) => setSkillForm((f) => ({ ...f, years_experience: e.target.value }))}
                    className="mt-1 text-sm"
                    placeholder="e.g. 5"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="bg-[var(--w-primary)] text-white hover:bg-[var(--w-primary-light)]"
                  onClick={handleSaveSkill}
                  disabled={savePending}
                >
                  {savePending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                  Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAddingSkill(false);
                    resetSkillForm();
                  }}
                >
                  <X className="h-3.5 w-3.5 mr-1" /> Cancel
                </Button>
              </div>
            </div>
          )}

          {skills.length === 0 && !addingSkill ? (
            <p className="text-sm text-[var(--w-text-muted)] italic">
              No skills added yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {skills.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border border-[var(--w-border)] bg-[var(--w-surface-alt)] text-[var(--w-text-secondary)] group"
                >
                  {s.name}
                  {s.proficiency && (
                    <span className="text-[var(--w-text-muted)]">· {s.proficiency}</span>
                  )}
                  <button
                    onClick={() => handleDeleteSkill(s.id)}
                    className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--w-text-muted)] hover:text-[var(--w-error)]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* Projects */}
      <Section
        title="Projects"
        icon={Code}
        onAdd={() => {
          setAddingProject(true);
          resetProjectForm();
        }}
      >
        <div className="space-y-3 pt-4">
          {addingProject &&
            renderProjectForm(() => {
              setAddingProject(false);
              resetProjectForm();
            })}

          {projects.length === 0 && !addingProject ? (
            <p className="text-sm text-[var(--w-text-muted)] italic">
              No projects added yet.
            </p>
          ) : (
            projects.map((p) =>
              editingProjectId === p.id ? (
                <div key={p.id}>
                  {renderProjectForm(() => {
                    setEditingProjectId(null);
                    resetProjectForm();
                  })}
                </div>
              ) : (
                <div key={p.id} className="rounded-lg border border-[var(--w-border)] p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--w-text-primary)]">{p.name}</p>
                      {p.description && (
                        <p className="text-xs text-[var(--w-text-secondary)] mt-0.5">{p.description}</p>
                      )}
                      {p.technologies && p.technologies.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {p.technologies.map((t) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.5 text-[10px] rounded bg-[var(--w-primary)]/10 text-[var(--w-primary)]"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-[var(--w-text-muted)] hover:text-[var(--w-primary)]"
                        onClick={() => startEditProject(p)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-[var(--w-text-muted)] hover:text-[var(--w-error)]"
                        onClick={() => handleDeleteProject(p.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            )
          )}
        </div>
      </Section>

      {/* Certifications */}
      <Section
        title="Certifications"
        icon={Award}
        onAdd={() => {
          setAddingCert(true);
          resetCertForm();
        }}
      >
        <div className="space-y-3 pt-4">
          {addingCert &&
            renderCertForm(() => {
              setAddingCert(false);
              resetCertForm();
            })}

          {certs.length === 0 && !addingCert ? (
            <p className="text-sm text-[var(--w-text-muted)] italic">
              No certifications added yet.
            </p>
          ) : (
            certs.map((c) =>
              editingCertId === c.id ? (
                <div key={c.id}>
                  {renderCertForm(() => {
                    setEditingCertId(null);
                    resetCertForm();
                  })}
                </div>
              ) : (
                <div key={c.id} className="rounded-lg border border-[var(--w-border)] p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--w-text-primary)]">{c.name}</p>
                      {c.issuing_organization && (
                        <p className="text-xs text-[var(--w-text-secondary)]">{c.issuing_organization}</p>
                      )}
                      <p className="text-xs text-[var(--w-text-muted)] mt-0.5">
                        {c.issue_date ?? ""}
                        {c.expiry_date ? ` — Expires ${c.expiry_date}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-[var(--w-text-muted)] hover:text-[var(--w-primary)]"
                        onClick={() => startEditCert(c)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-[var(--w-text-muted)] hover:text-[var(--w-error)]"
                        onClick={() => handleDeleteCert(c.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            )
          )}
        </div>
      </Section>
    </div>
  );
}
