"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";

const signinSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type SigninValues = z.infer<typeof signinSchema>;

function SigninForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SigninValues>({ resolver: zodResolver(signinSchema) });

  const onSubmit = async (values: SigninValues) => {
    setSubmitting(true);
    const res = await signIn("credentials", {
      ...values,
      redirect: false,
    });
    setSubmitting(false);

    if (res?.error) {
      toast.error(res.error === "CredentialsSignin" ? "Incorrect email or password." : res.error);
      return;
    }

    toast.success("Welcome back!");
    router.push(searchParams?.get("callbackUrl") || "/dashboard");
    router.refresh();
  };

  return (
    <div className="glass rounded-[1.75rem] p-6 sm:p-9">
      <h1 className="font-display text-[1.875rem] font-bold leading-tight text-ink">Sign in</h1>
      <p className="mt-2 text-body text-ink-muted">Welcome back. Sign in to your Gobi account.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4" noValidate>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" icon={<Mail />} placeholder="you@example.com" {...register("email")} />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <Input
            type="password"
            autoComplete="current-password"
            icon={<Lock />}
            placeholder="••••••••"
            {...register("password")}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-body text-ink-muted">
        No account yet?{" "}
        <Link href="/signup" className="focus-ring rounded font-semibold text-primary-600 hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}

export default function SigninPage() {
  return (
    <Suspense>
      <SigninForm />
    </Suspense>
  );
}
