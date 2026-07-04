import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/common/ui/components/button";
import { Input } from "@/common/ui/components/input";
import { useAuth } from "../data/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setLoading(true);
    const res = await login(email.trim(), password);
    setLoading(false);
    if (res.ok) navigate("/");
    else setError(res.message ?? "Invalid email or password");
  };

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="mb-6 text-2xl font-bold">Log in</h1>
      <form onSubmit={submit} className="space-y-4">
        <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>{loading ? "Logging in…" : "Log in"}</Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        No account? <Link to="/register" className="font-medium text-foreground hover:underline">Sign up</Link>
      </p>
    </div>
  );
}
