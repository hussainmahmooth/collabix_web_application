import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowUpRight, FlaskConical, Check, ArrowRight } from "lucide-react";
import { configured, supabase } from "./lib/supabase";
import { Button, Footer } from "./components/ui";
const schema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters"),
  name: z.string().max(120).optional(),
});
type Values = z.infer<typeof schema>;
export default function Auth({
  recovery = false,
  onRecovered,
}: {
  recovery?: boolean;
  onRecovered: () => void;
}) {
  const location = useLocation();
  const registerMode = location.pathname === "/register";
  const reset = location.pathname === "/reset-password";
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: reset ? "unused-reset-password" : "" },
  });
  const submit = handleSubmit(async (values) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!configured)
        throw new Error(
          "Supabase is not configured. See the deployment guide.",
        );
      if (recovery) {
        const { error } = await supabase.auth.updateUser({
          password: values.password,
        });
        if (error) throw error;
        onRecovered();
        window.location.assign("/dashboard");
      } else if (reset) {
        const { error } = await supabase.auth.resetPasswordForEmail(
          values.email,
          { redirectTo: `${window.location.origin}/reset-password` },
        );
        if (error) throw error;
        setNotice(
          "If that account exists, a password reset link is on its way.",
        );
      } else if (registerMode) {
        const { error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            data: { full_name: values.name || "Researcher" },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
        setNotice("Check your email to verify your account, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });
        if (error) throw error;
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to authenticate. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  });
  return (
    <div className="auth-page">
      <div className="auth-content">
        <aside className="auth-story">
          <Link to="/" className="brand">
            <span className="brand-icon">
              <FlaskConical size={23} />
            </span>
            ResearchFlow<span className="brand-period">.</span>
          </Link>
          <div className="story-body">
            <span className="eyebrow light">
              FROM FIRST QUESTION TO FINAL PAPER
            </span>
            <h1>
              Great research
              <br />
              happens <em>together.</em>
            </h1>
            <p>
              One thoughtful workspace for your team,
              <br />
              your ideas, and your next breakthrough.
            </p>
            <div className="research-orbit">
              <div className="orbit-ring" />
              <div className="orbit-center">
                <FlaskConical size={45} />
              </div>
              <span className="orbit-card one">
                <Check size={15} /> Literature review
              </span>
              <span className="orbit-card two">
                <span className="tiny-avatar">R</span> A shared direction{" "}
                <ArrowUpRight size={16} />
              </span>
              <span className="orbit-card three">
                <span className="status-dot" /> Ready for the next discovery
              </span>
            </div>
            <div className="story-caption">
              <span>01 — A PLACE TO MAKE PROGRESS</span>
              <span>RESEARCH, CONNECTED ↗</span>
            </div>
          </div>
        </aside>
        <main className="auth-form-panel">
          <span className="auth-top">
            BUILT FOR CURIOUS MINDS <span>↗</span>
          </span>
          <div className="auth-form">
            <span className="eyebrow">YOUR RESEARCH STARTS HERE</span>
            <h2>
              {recovery
                ? "Choose a new password"
                : reset
                  ? "Let’s get you back in."
                  : registerMode
                    ? "Start something meaningful."
                    : "Welcome back."}
            </h2>
            <p>
              {recovery
                ? "Set a strong password for your account."
                : reset
                  ? "We’ll send you a secure link to reset your password."
                  : registerMode
                    ? "Create your account. Bring your research team together."
                    : "Good to see you. Let’s move your research forward."}
            </p>
            <form onSubmit={submit}>
              {registerMode && (
                <label>
                  Full name
                  <input
                    {...register("name")}
                    autoComplete="name"
                    required
                    placeholder="Your full name"
                    maxLength={120}
                  />
                </label>
              )}
              <label className={recovery ? "sr-only" : ""}>
                Email address
                <input
                  {...register("email")}
                  type="email"
                  autoComplete="email"
                  placeholder="you@university.edu"
                  defaultValue={recovery ? "recovery@example.com" : ""}
                />
                {errors.email && (
                  <small className="field-error">{errors.email.message}</small>
                )}
              </label>
              {!reset || recovery ? (
                <label>
                  Password
                  <input
                    {...register("password")}
                    type="password"
                    autoComplete={
                      registerMode || recovery
                        ? "new-password"
                        : "current-password"
                    }
                    placeholder="At least 8 characters"
                  />
                  {errors.password && (
                    <small className="field-error">
                      {errors.password.message}
                    </small>
                  )}
                </label>
              ) : null}
              {!registerMode && !reset && !recovery && (
                <Link className="forgot" to="/reset-password">
                  Forgot password?
                </Link>
              )}
              {error && (
                <div role="alert" className="error-box">
                  {error}
                </div>
              )}
              {notice && (
                <div role="status" className="success-box">
                  {notice}
                </div>
              )}
              <Button disabled={busy || !configured} type="submit">
                {busy
                  ? "Please wait…"
                  : recovery
                    ? "Update password"
                    : reset
                      ? "Send reset link"
                      : registerMode
                        ? "Create account"
                        : "Sign in to your workspace"}
                <ArrowRight size={17} />
              </Button>
            </form>
            {!configured && (
              <div role="alert" className="error-box">
                Database connection is not configured. No demo data is shown.
              </div>
            )}
            <p className="auth-switch">
              {registerMode
                ? "Already part of a team?"
                : reset
                  ? "Remember your password?"
                  : "New to ResearchFlow?"}{" "}
              <Link to={registerMode || reset ? "/login" : "/register"}>
                {registerMode || reset ? "Sign in" : "Create an account"}{" "}
                <ArrowUpRight size={13} />
              </Link>
            </p>
            <div className="auth-trust">
              <span className="status-dot" /> Secure by design. Made for
              collaboration.
            </div>
          </div>
          <span className="auth-bottom">
            A SHARED HOME FOR YOUR NEXT BIG IDEA.
          </span>
        </main>
      </div>
      <Footer />
    </div>
  );
}
