import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/common/ui/components/button";
import { Input } from "@/common/ui/components/input";
import { useAuth } from "../data/AuthContext";
import { startRegistration, verifyCode, completeRegistration } from "../data/auth";

type Step = "email" | "code" | "password";

export default function RegisterPage() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const err = (r: { type: string; message?: string }, fallback: string) =>
    setError(r.type === "error" ? (r as { message?: string }).message ?? fallback : fallback);

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true);
    const res = await startRegistration(email.trim());
    setLoading(false);
    if (res.type === "success") setStep("code");
    else err(res, "Could not start registration");
  };
  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true);
    const res = await verifyCode(email.trim(), code.trim());
    setLoading(false);
    if (res.type === "success") setStep("password");
    else err(res, "Invalid code");
  };
  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setLoading(true);
    const res = await completeRegistration(email.trim(), code.trim(), password);
    setLoading(false);
    if (res.type === "success") { await refresh(); navigate("/"); }
    else err(res, "Could not create your account");
  };
  const resend = async () => { setError(null); await startRegistration(email.trim()); };

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="mb-6 text-2xl font-bold">Create account</h1>
      {step === "email" && (
        <form onSubmit={submitEmail} className="space-y-4">
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "Sending…" : "Send code"}</Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account? <Link to="/login" className="font-medium text-foreground hover:underline">Log in</Link>
          </p>
        </form>
      )}
      {step === "code" && (
        <form onSubmit={submitCode} className="space-y-4">
          <p className="text-sm text-muted-foreground">We emailed a 6-digit code to {email}.</p>
          <Input inputMode="numeric" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} required />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "Checking…" : "Verify"}</Button>
          <button type="button" onClick={resend} className="w-full text-sm text-muted-foreground hover:underline">Resend code</button>
        </form>
      )}
      {step === "password" && (
        <form onSubmit={submitPassword} className="space-y-4">
          <Input type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Input type="password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating…" : "Create account"}</Button>
        </form>
      )}
    </div>
  );
}
