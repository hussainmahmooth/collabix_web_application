import { lazy, Suspense, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  FlaskConical,
  LayoutDashboard,
  CheckSquare,
  Layers3,
  Users,
  Settings,
  LogOut,
  Plus,
  ArrowUpRight,
  Search,
  Menu,
  X,
  Sun,
  Moon,
  ChevronDown,
  MessageSquare,
  Files,
  CalendarDays,
  GraduationCap,
  Megaphone,
  History,
} from "lucide-react";
import { supabase, check } from "./lib/supabase";
import { readPages } from "./lib/pagination";
import type {
  Workspace,
  Member,
  Phase,
  Task,
  Audit,
  Invitation,
} from "./lib/types";
import { initials } from "./lib/types";
import { Button, Footer, Modal, Empty } from "./components/ui";
import Auth from "./Auth";
import { NotificationBell } from "./research/Notifications";
const ResearchView = lazy(() => import("./research/ResearchView"));
const researchPages = [
  "papers",
  "datasets",
  "notifications",
  "analytics",
  "reports",
  "github",
  "timeline",
];
const WorkspaceView = lazy(() => import("./WorkspaceView"));
const CollaborationView = lazy(
  () => import("./collaboration/CollaborationView"),
);
const collaborationPages = [
  "discussions",
  "documents",
  "meetings",
  "reviews",
  "announcements",
  "activity",
];

export interface WorkspaceData {
  workspace: Workspace;
  members: Member[];
  phases: Phase[];
  tasks: Task[];
  audit: Audit[];
  invitations: Invitation[];
}
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(
    window.location.hash.includes("type=recovery"),
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [workspaceId, setWorkspaceId] = useState(
    localStorage.getItem("rf-workspace") || "",
  );
  const [create, setCreate] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [dark, setDark] = useState(localStorage.getItem("rf-theme") === "dark");
  const client = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("rf-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      setSession(data.session);
      if (error) setError(error.message);
      setReady(true);
    }).catch(() => {
      if (mounted) {
        setError("Unable to restore your session. Please sign in again.");
        setReady(true);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") {
        client.clear();
        setWorkspaceId("");
        localStorage.removeItem("rf-workspace");
      }
    });
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, [client]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const workspaces = useQuery({
    queryKey: ["workspaces", session?.user.id],
    enabled: !!session,
    queryFn: async () =>
      (
        check(
          await supabase.from("rf_workspaces").select("*").order("created_at"),
        ) || []
      ).map((w) => w as Workspace),
  });
  const active =
    workspaces.data?.find((w) => w.id === workspaceId) || workspaces.data?.[0];
  useEffect(() => {
    if (
      session &&
      !recovery &&
      ["/login", "/register"].includes(location.pathname)
    )
      navigate("/dashboard", { replace: true });
  }, [session, recovery, location.pathname, navigate]);
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--accent",
      active?.accent_color || "#168e88",
    );
  }, [active?.accent_color]);
  const details = useQuery({
    queryKey: ["workspace", active?.id, session?.user.id],
    enabled: !!active && !!session,
    queryFn: async () => {
      const w = active!;
      const memberRows = check(
        await supabase
          .from("rf_workspace_members")
          .select("user_id,role,responsibilities,rf_profiles(full_name,skills)")
          .eq("workspace_id", w.id),
      ) as unknown as Member[];
      const leader = memberRows.some(
        (m) => m.user_id === session?.user.id && m.role === "leader",
      );
      const results = await Promise.all([
        supabase
          .from("rf_research_phases")
          .select("*")
          .eq("workspace_id", w.id)
          .order("position"),
        readPages<Task>((from, to) => supabase
          .from("rf_tasks")
          .select("*")
          .eq("workspace_id", w.id)
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to)),
        supabase
          .from("rf_audit_events")
          .select("*")
          .eq("workspace_id", w.id)
          .order("created_at", { ascending: false })
          .limit(20),
        leader
          ? supabase
              .from("rf_workspace_invitations")
              .select("*")
              .eq("workspace_id", w.id)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);
      return {
        workspace: w,
        members: memberRows,
        phases: check(results[0]) as Phase[],
        tasks: results[1],
        audit: check(results[2]) as Audit[],
        invitations: check(results[3]) as Invitation[],
      };
    },
  });
  async function refresh() {
    await client.invalidateQueries({ queryKey: ["workspaces"] });
    await client.invalidateQueries({ queryKey: ["workspace"] });
  }
  async function mutate(
    action: () => Promise<unknown>,
    message = "Changes saved",
  ) {
    setError("");
    setBusy(true);
    try {
      await action();
      await refresh();
      setNotice(message);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function createWorkspace(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await mutate(async () => {
      const id = check(
        await supabase.rpc("rf_create_workspace", {
          team_name: f.get("name"),
          title: f.get("title"),
          full_name: session?.user.user_metadata.full_name || "Researcher",
        }),
      );
      setWorkspaceId(id);
      localStorage.setItem("rf-workspace", id);
      setCreate(false);
      navigate("/dashboard");
    }, "Your research workspace is ready");
  }
  const invitationToken =
    new URLSearchParams(location.search).get("invite") ||
    sessionStorage.getItem("rf-invite");
  useEffect(() => {
    const token = new URLSearchParams(location.search).get("invite");
    if (token) sessionStorage.setItem("rf-invite", token);
  }, [location.search]);
  if (!ready)
    return (
      <div className="loading-screen">
        <FlaskConical />
        <p>Opening ResearchFlow…</p>
      </div>
    );
  if (!session || recovery || location.pathname === "/reset-password")
    return <Auth recovery={recovery} onRecovered={() => setRecovery(false)} />;
  const currentMember = details.data?.members.find(
    (m) => m.user_id === session.user.id,
  );
  const name =
    currentMember?.rf_profiles.full_name ||
    session.user.user_metadata.full_name ||
    session.user.email?.split("@")[0] ||
    "Researcher";
  const page = location.pathname.split("/")[1] || "dashboard";
  return (
    <div className="app-shell">
      <aside className={`sidebar ${drawer ? "open" : ""}`}>
        <Link className="brand" to="/dashboard">
          <span className="brand-icon">
            <FlaskConical size={23} />
          </span>
          ResearchFlow<span className="brand-period">.</span>
        </Link>
        <button
          className="mobile-close icon-button"
          onClick={() => setDrawer(false)}
          aria-label="Close navigation"
        >
          <X />
        </button>
        <div className="workspace-control">
          <span className="workspace-avatar">
            {initials(active?.name || "Research")}
          </span>
          <div>
            <small>RESEARCH WORKSPACE</small>
            <select
              aria-label="Switch workspace"
              value={active?.id || ""}
              onChange={(e) => {
                setWorkspaceId(e.target.value);
                localStorage.setItem("rf-workspace", e.target.value);
                setSearch("");
              }}
            >
              {!workspaces.data?.length && (
                <option value="">Create your workspace</option>
              )}
              {workspaces.data?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <ChevronDown size={13} />
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          {[
            { url: "dashboard", label: "Overview", icon: LayoutDashboard },
            { url: "tasks", label: "Tasks", icon: CheckSquare },
            { url: "phases", label: "Research phases", icon: Layers3 },
            { url: "team", label: "Team members", icon: Users },
            { url: "discussions", label: "Discussions", icon: MessageSquare },
            { url: "documents", label: "Documents", icon: Files },
            { url: "meetings", label: "Meetings", icon: CalendarDays },
            {
              url: "reviews",
              label: "Supervisor Reviews",
              icon: GraduationCap,
            },
            { url: "announcements", label: "Announcements", icon: Megaphone },
            { url: "activity", label: "Activity history", icon: History },
            { url: "papers", label: "Research Papers", icon: Files },
            { url: "datasets", label: "Datasets", icon: Layers3 },
            { url: "notifications", label: "Notifications", icon: Megaphone },
            { url: "analytics", label: "Analytics", icon: LayoutDashboard },
            { url: "reports", label: "Reports", icon: Files },
            { url: "github", label: "GitHub Tracking", icon: CheckSquare },
            { url: "timeline", label: "Research Timeline", icon: CalendarDays },
          ].map((n) => (
            <NavLink
              key={n.url}
              to={`/${n.url}`}
              onClick={() => {
                setDrawer(false);
                setSearch("");
              }}
              className={({ isActive }) =>
                isActive || (n.url === "dashboard" && page === "")
                  ? "active"
                  : ""
              }
            >
              <n.icon size={19} />
              {n.label}
              {n.url === "tasks" && (
                <span className="nav-count">
                  {details.data?.tasks.filter(
                    (t) => !t.archived && t.status !== "Completed",
                  ).length || 0}
                </span>
              )}
            </NavLink>
          ))}
          <span className="nav-label secondary">MANAGE</span>
          <NavLink to="/settings" onClick={() => setDrawer(false)}>
            <Settings size={19} />
            Settings
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="eyebrow light">SMALL STEPS. BIG DISCOVERIES.</span>
            <p>
              Make room for your
              <br />
              next breakthrough.
            </p>
            <FlaskConical size={32} />
          </div>
          <Button variant="ghost" onClick={() => setCreate(true)}>
            <Plus size={17} /> New workspace
          </Button>
          <button
            className="user-block"
            onClick={() =>
              mutate(async () => {
                const result = await supabase.auth.signOut();
                if (result.error) throw result.error;
              }, "Signed out")
            }
            aria-label="Sign out"
          >
            <span className="avatar">{initials(name)}</span>
            <span>
              <strong>{name}</strong>
              <small>{currentMember?.role || "Researcher"}</small>
            </span>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      {drawer && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setDrawer(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setDrawer(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            Workspace <span>/</span>
            <strong>
              {page === "dashboard"
                ? "Overview"
                : page.charAt(0).toUpperCase() + page.slice(1)}
            </strong>
          </div>
          <div className="topbar-actions">
            {active && (
              <NotificationBell workspace={active.id} user={session.user.id} />
            )}
            <label className="search">
              <Search size={17} />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (page !== "tasks") navigate("/tasks");
                }}
                placeholder="Search tasks…"
                aria-label="Search tasks"
              />
              <kbd>⌕</kbd>
            </label>
            <button
              className="icon-button"
              onClick={() => setDark(!dark)}
              aria-label={
                dark ? "Switch to light theme" : "Switch to dark theme"
              }
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <span className="topbar-divider" />
            <span className="avatar small">{initials(name)}</span>
          </div>
        </header>
        <main className="content">
          {(error || workspaces.error || details.error) && (
            <div className="error-box" role="alert">
              {error || workspaces.error?.message || details.error?.message}
              <Button
                variant="ghost"
                onClick={() => {
                  setError("");
                  void refresh();
                }}
              >
                Retry
              </Button>
            </div>
          )}
          {invitationToken && (
            <div className="invite-banner">
              <div>
                <strong>You have a workspace invitation</strong>
                <p>
                  Accept using the verified email address the invitation was
                  sent to.
                </p>
              </div>
              <Button
                disabled={busy}
                onClick={() =>
                  mutate(async () => {
                    const id = check(
                      await supabase.rpc("rf_accept_invitation", {
                        invite_token: invitationToken,
                        full_name: name,
                      }),
                    );
                    sessionStorage.removeItem("rf-invite");
                    setWorkspaceId(id);
                    localStorage.setItem("rf-workspace", id);
                    navigate("/dashboard");
                  }, "Invitation accepted")
                }
              >
                Join workspace <ArrowUpRight size={16} />
              </Button>
            </div>
          )}
          {workspaces.isPending || (active && details.isPending) ? (
            <div className="skeleton-grid" aria-label="Loading workspace">
              <div />
              <div />
              <div />
              <div />
            </div>
          ) : !active ? (
            <>
              <div className="page-heading">
                <span className="eyebrow">A NEW CHAPTER</span>
                <h1>Your next discovery starts here.</h1>
                <p>
                  A shared home for your research, from the first question to
                  the final paper.
                </p>
              </div>
              <Empty
                title="Bring your team together"
                action={
                  <Button onClick={() => setCreate(true)}>
                    <Plus size={17} />
                    Create a workspace
                  </Button>
                }
              >
                Create a research workspace or follow an invitation link from
                your team leader.
              </Empty>
            </>
          ) : (
            details.data && (
              <Suspense
                fallback={
                  <div className="loading-screen">Loading workspace…</div>
                }
              >
                {researchPages.includes(page) ? (
                  <ResearchView
                    key={active.id}
                    workspace={{ ...details.data, workspace: active }}
                    userId={session.user.id}
                    page={page}
                    busy={busy}
                    mutate={mutate}
                  />
                ) : collaborationPages.includes(page) ? (
                  <CollaborationView
                    key={active.id}
                    workspace={{ ...details.data, workspace: active }}
                    userId={session.user.id}
                    page={page}
                    busy={busy}
                    mutate={mutate}
                  />
                ) : (
                  <WorkspaceView
                    key={active.id}
                    data={{ ...details.data, workspace: active }}
                    userId={session.user.id}
                    name={name}
                    page={page}
                    search={search}
                    busy={busy}
                    mutate={mutate}
                  />
                )}
              </Suspense>
            )
          )}
        </main>
        <Footer />
      </div>
      {error && (
        <div role="alert" className="toast error-toast">
          {error}
          <button
            className="icon-button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="toast">
          <CheckSquare size={18} />
          {notice}
        </div>
      )}
      {create && (
        <Modal
          title="A home for your research"
          description="Start a workspace. Invite your team. Take the first step together."
          onClose={() => setCreate(false)}
        >
          <form onSubmit={createWorkspace}>
            <label>
              Team name
              <input
                name="name"
                required
                maxLength={120}
                placeholder="e.g. Applied Intelligence Lab"
              />
            </label>
            <label>
              Research title
              <input
                name="title"
                required
                maxLength={300}
                placeholder="What is your team exploring?"
              />
            </label>
            <p className="form-hint">
              You’ll become the team leader. Seven editable research phases will
              help you get started.
            </p>
            <Button disabled={busy} type="submit">
              {busy ? "Creating…" : "Create workspace"}
              <ArrowUpRight size={17} />
            </Button>
          </form>
        </Modal>
      )}
      <nav className="mobile-bottom">
        <NavLink to="/dashboard">
          <LayoutDashboard size={20} />
          Overview
        </NavLink>
        <NavLink to="/tasks">
          <CheckSquare size={20} />
          Tasks
        </NavLink>
        <NavLink to="/phases">
          <Layers3 size={20} />
          Phases
        </NavLink>
        <NavLink to="/team">
          <Users size={20} />
          Team
        </NavLink>
      </nav>
    </div>
  );
}
