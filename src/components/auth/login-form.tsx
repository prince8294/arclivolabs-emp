"use client";

import { useState, type FormEvent } from "react";
import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { credentialsSchema } from "@/lib/auth/validation";

type FormErrors = { email?: string; password?: string };

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "email" || field === "password") fieldErrors[field] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        redirect: false,
        email: parsed.data.email,
        password: parsed.data.password,
      });

      if (!result || result.error) {
        setFormError("We couldn’t sign you in. Check your details or contact your administrator.");
        return;
      }

      const session = await getSession();
      if (!session?.user?.role) {
        setFormError("Your session could not be established. Please try signing in again.");
        return;
      }
      router.replace(session?.user.role === "admin" ? "/admin/dashboard" : "/employee/dashboard");
      router.refresh();
    } catch {
      setFormError("Sign in is temporarily unavailable. Please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <Input
        label="Work email"
        name="email"
        type="email"
        placeholder="name@arclivolabs.com"
        autoComplete="username"
        inputMode="email"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          if (errors.email) setErrors((current) => ({ ...current, email: undefined }));
        }}
        error={errors.email}
        required
      />
      <Input
        label="Password"
        name="password"
        type={showPassword ? "text" : "password"}
        placeholder="Enter your password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          if (errors.password) setErrors((current) => ({ ...current, password: undefined }));
        }}
        error={errors.password}
        required
        trailing={
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 transition hover:text-slate-200"
          >
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        }
      />
      {formError && (
        <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm leading-5 text-rose-200">
          {formError}
        </p>
      )}
      <Button type="submit" className="mt-1 w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Spinner /> Signing in…
          </>
        ) : (
          <>
            <LockKeyhole size={16} strokeWidth={1.8} /> Sign In
          </>
        )}
      </Button>
    </form>
  );
}
