"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { ArrowLeft, Lock, Mail, MailCheck, Phone } from "lucide-react";
import axios from "@/lib/axios";
import { apiErrorMessage } from "@/lib/handleApiError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Callout } from "@/components/ui/feedback";
import { OrgInvitation } from "@/types";

const signupSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  phoneNumber: z
    .string()
    .regex(/^\+?[0-9]{9,15}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignupValues = z.infer<typeof signupSchema>;

/** A sign-up waiting for its emailed code (from POST /auth/register). */
interface PendingSignup {
  id: string;
  email: string;
  expiresAt: string;
  resendAvailableAt: string;
}

const secondsUntil = (iso: string, now: number) => Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 1000));

function SignupForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  // Arriving from an emailed invitation: the account must use the invited email.
  const inviteToken = useSearchParams()?.get("invite") ?? null;
  const invitePath = inviteToken ? `/invite/${encodeURIComponent(inviteToken)}` : null;

  // Step two: the account is created only once the emailed code is confirmed.
  const [pending, setPending] = useState<PendingSignup | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string>();
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // Kept in memory only, to sign in once the account exists.
  const credentials = useRef<{ email: string; password: string } | null>(null);

  const { data: invitation } = useQuery({
    queryKey: ["invitation", inviteToken],
    enabled: Boolean(inviteToken),
    retry: false,
    queryFn: async () =>
      (await axios.get(`/api/v1/invitations/${inviteToken}`)).data.data.invitation as OrgInvitation,
  });
  const invited = invitation?.status === "pending" ? invitation : null;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
  });

  useEffect(() => {
    if (invited) setValue("email", invited.email, { shouldValidate: true });
  }, [invited, setValue]);

  // Ticks the resend countdown while a code is outstanding.
  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [pending]);

  const finish = async () => {
    const signedIn = await signIn("credentials", { ...credentials.current, redirect: false });
    if (signedIn?.error) {
      toast.error("Your account is ready. Sign in to continue.");
      router.push("/signin");
      return;
    }
    if (invitePath) {
      toast.success("Account created. Accept the invitation to join.");
      router.push(invitePath);
    } else {
      toast.success("Account created. Welcome to Gobi!");
      router.push("/dashboard");
    }
    router.refresh();
  };

  const onSubmit = async (values: SignupValues) => {
    setSubmitting(true);
    try {
      const { data } = await axios.post("/api/v1/auth/register", {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
        ...(values.phoneNumber && { phoneNumber: values.phoneNumber }),
        ...(invited && inviteToken && { inviteToken }),
      });
      credentials.current = { email: values.email, password: values.password };
      if (data.data.user) {
        // The invitation already proved this inbox, so the account exists now.
        await finish();
      } else {
        setPending(data.data.verification);
        setNow(Date.now());
      }
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const verify = async (value: string) => {
    if (!pending || verifying) return;
    setVerifying(true);
    setCodeError(undefined);
    try {
      await axios.post("/api/v1/auth/verify-email", { verificationId: pending.id, code: value });
      await finish();
    } catch (error) {
      setCodeError(apiErrorMessage(error));
      setVerifying(false);
    }
  };

  const resend = async () => {
    if (!pending) return;
    setResending(true);
    try {
      const { data } = await axios.post("/api/v1/auth/resend-verification", { verificationId: pending.id });
      setPending(data.data.verification);
      setNow(Date.now());
      setCode("");
      setCodeError(undefined);
      toast.success(`We sent a new code to ${pending.email}.`);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setResending(false);
    }
  };

  if (pending) {
    const resendIn = secondsUntil(pending.resendAvailableAt, now);
    return (
      <div className="glass rounded-[1.75rem] p-6 sm:p-9">
        <span className="flex h-12 w-12 items-center justify-center rounded-[0.875rem] bg-primary-500 text-white shadow-brand">
          <MailCheck className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="font-display mt-5 text-[1.875rem] font-bold leading-tight text-ink">Check your email</h1>
        <p className="mt-2 text-body text-ink-muted">
          We sent a 6-digit code to <span className="font-medium text-ink-secondary">{pending.email}</span>. Enter
          it to finish creating your account. It expires in 15 minutes.
        </p>

        <form
          className="mt-7 space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            verify(code);
          }}
        >
          <Field label="Verification code" error={codeError}>
            <Input
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              disabled={verifying}
              aria-invalid={Boolean(codeError)}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(digits);
                setCodeError(undefined);
                if (digits.length === 6) verify(digits);
              }}
              className="h-control-lg text-center font-mono text-[1.375rem] tracking-[0.5em]"
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={code.length !== 6} loading={verifying}>
            {verifying ? "Creating account..." : "Verify and create account"}
          </Button>
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-body">
          <button
            type="button"
            onClick={() => {
              setPending(null);
              setCode("");
              setCodeError(undefined);
            }}
            className="focus-ring inline-flex items-center gap-1.5 rounded text-ink-muted hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Use a different email
          </button>
          <button
            type="button"
            disabled={resendIn > 0 || resending}
            onClick={resend}
            className="focus-ring rounded font-semibold text-primary-600 hover:underline disabled:cursor-not-allowed disabled:font-medium disabled:text-ink-muted disabled:no-underline"
          >
            {resending ? "Sending..." : resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-[1.75rem] p-6 sm:p-9">
      <h1 className="font-display text-[1.875rem] font-bold leading-tight text-ink">Create your account</h1>
      {invited ? (
        <Callout tone="info" className="mt-4">
          You&apos;re joining <span className="font-semibold">{invited.organization?.name}</span> as {invited.role}.
          Create your account with the invited email, then accept the invitation.
        </Callout>
      ) : (
        <p className="mt-2 text-body text-ink-muted">
          Create your personal account, then set up your company workspace or get added to an existing
          organization. We&apos;ll email you a code to confirm your address.
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" error={errors.firstName?.message}>
            <Input autoComplete="given-name" placeholder="Claire" {...register("firstName")} />
          </Field>
          <Field label="Last name" error={errors.lastName?.message}>
            <Input autoComplete="family-name" placeholder="Uwase" {...register("lastName")} />
          </Field>
        </div>
        <Field
          label="Email"
          hint={invited ? "This is the address the invitation was sent to." : undefined}
          error={errors.email?.message}
        >
          <Input
            type="email"
            autoComplete="email"
            icon={<Mail />}
            placeholder="you@example.com"
            readOnly={Boolean(invited)}
            {...register("email")}
          />
        </Field>
        <Field label="Phone number" optional error={errors.phoneNumber?.message}>
          <Input type="tel" autoComplete="tel" icon={<Phone />} placeholder="+250788123456" {...register("phoneNumber")} />
        </Field>
        <Field label="Password" hint="At least 8 characters." error={errors.password?.message}>
          <Input
            type="password"
            autoComplete="new-password"
            icon={<Lock />}
            placeholder="At least 8 characters"
            {...register("password")}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          {submitting ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-body text-ink-muted">
        Already have an account?{" "}
        <Link
          href={invitePath ? `/signin?callbackUrl=${encodeURIComponent(invitePath)}` : "/signin"}
          className="focus-ring rounded font-semibold text-primary-600 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
