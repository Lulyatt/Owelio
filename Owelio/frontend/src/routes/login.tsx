import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { api, useAction } from "@/lib/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({ redirect: typeof s["redirect"] === "string" ? s["redirect"] : undefined }),
  head: () => ({
    meta: [
      { title: "Log in — Owelio" },
      { name: "description", content: "Log in or register for an Owelio account to split expenses with your groups." },
      { property: "og:title", content: "Log in — Owelio" },
      { property: "og:description", content: "Log in or register for an Owelio account to split expenses with your groups." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const done = () => (redirect && redirect.startsWith("/") ? (window.location.href = redirect) : navigate({ to: "/" }));
  const login = useAction(() => api().auth.login({ email, password }));
  const register = useAction(() => api().auth.register({ name, email, password }));

  return (
    <div className="mx-auto mt-10 grid max-w-4xl gap-10 md:grid-cols-2 md:items-center">
      <div>
        <h1 className="text-5xl font-bold leading-tight text-primary">Fair shares, no awkward maths.</h1>
        <p className="mt-4 text-muted-foreground">
          Holidays, dinners, flatshares. Log what was spent, choose who it was for, and Owelio works out the fewest payments to settle up.
        </p>
        <p className="mt-6 rounded-md border border-dashed bg-muted p-3 text-sm text-muted-foreground">
          Demo account: <b>alex@example.com</b> / <b>password123</b>
        </p>
      </div>
      <div className="rounded-lg border bg-card p-6 shadow-ledger">
        <Tabs defaultValue="login">
          <TabsList className="mb-4 grid w-full grid-cols-2">
            <TabsTrigger value="login">Log in</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); await login.mutateAsync(undefined); done(); }}>
              <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
              <Field label="Password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
              <Button className="w-full" disabled={login.isPending}>Log in</Button>
            </form>
          </TabsContent>
          <TabsContent value="register">
            <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); await register.mutateAsync(undefined); done(); }}>
              <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
              <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
              <Field label="Password (8+ characters)"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
              <Button className="w-full" disabled={register.isPending}>Register</Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
