"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Welcome back. Sign in to your Gobi account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" {...register("email")} />
            {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="••••••••" {...register("password")} />
            {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-mute">
          No account yet?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function SigninPage() {
  return (
    <Suspense>
      <SigninForm />
    </Suspense>
  );
}
