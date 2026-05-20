"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

import { login, register } from "@/lib/authApi";
import { ApiClientError } from "@/lib/api";
import { validateEmail, validatePassword } from "@/lib/validation";

import { Alert } from "./Alert";
import { Button } from "./Button";
import { FormField } from "./FormField";

type AuthFormMode = "login" | "register";

export function AuthForm({ mode }: { mode: AuthFormMode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRegister = mode === "register";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const emailError = validateEmail(email) ?? undefined;
    const passwordError = validatePassword(password) ?? undefined;
    const nextErrors: { email?: string; password?: string } = {};
    nextErrors.email = emailError;
    nextErrors["password"] = passwordError;

    if (nextErrors.email || nextErrors.password) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      if (isRegister) {
        await register({ email, password });
      } else {
        await login({ email, password });
      }

      router.push("/papers");
      router.refresh();
    } catch (error) {
      setErrors({
        form: error instanceof ApiClientError ? error.message : "Unable to authenticate right now."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
      {errors.form ? <Alert tone="error">{errors.form}</Alert> : null}
      <FormField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        error={errors.email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <FormField
        label="Password"
        name="password"
        type="password"
        autoComplete={isRegister ? "new-password" : "current-password"}
        value={password}
        error={errors.password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Submitting..." : isRegister ? "Create account" : "Log in"}
      </Button>
      <p className="form-switch">
        {isRegister ? "Already have an account?" : "Need an account?"}{" "}
        <Link href={isRegister ? "/login" : "/register"}>{isRegister ? "Log in" : "Register"}</Link>
      </p>
    </form>
  );
}
