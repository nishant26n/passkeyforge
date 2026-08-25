"use client";

import { useId, useState } from "react";

const inputClass =
  "w-full rounded-[8px] border border-border bg-surface px-3.5 h-11 text-[15px] text-text-primary outline-none transition shadow-[0_1px_2px_rgba(16,20,22,0.04)] placeholder:text-text-tertiary focus:border-accent focus:ring-3 focus:ring-accent-ring disabled:opacity-60";

const labelClass = "text-[13px] font-semibold text-text-secondary";

type FieldProps = Omit<React.ComponentProps<"input">, "id" | "className"> & {
  label: string;
  hint?: React.ReactNode;
  error?: string;
};

export function Field({ label, hint, error, ...props }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="space-y-[7px]">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
        {hint}
      </div>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={inputClass}
        {...props}
      />
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

export function PasswordField({ label, hint, error, ...props }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-[7px]">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
        {hint}
      </div>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`${inputClass} pr-11`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-text-tertiary transition hover:text-text-secondary"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[17px] w-[17px]"
            aria-hidden
          >
            <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
            <circle cx="12" cy="12" r="2.8" />
            {!visible ? <path d="m4 20 16-16" /> : null}
          </svg>
        </button>
      </div>
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

export function FieldError({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <p id={id} className="text-xs text-error-text">
      {children}
    </p>
  );
}

const alertStyles = {
  error: "border-error-border bg-error-bg text-error-text",
  success: "border-success-border bg-success-bg text-success-text",
  warning: "border-warning-border bg-warning-bg text-warning-text",
};

export function Alert({
  variant = "error",
  children,
}: {
  variant?: "error" | "success" | "warning";
  children: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className={`rounded-[8px] border px-3 py-2.5 text-sm font-medium ${alertStyles[variant]}`}
    >
      {children}
    </div>
  );
}

export function SubmitButton({
  pending,
  disabled,
  children,
}: {
  pending?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={disabled ?? pending}
      className="flex h-11 w-full items-center justify-center rounded-[8px] bg-accent text-[15px] font-semibold text-accent-on transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60 shadow-[0_1px_2px_rgba(16,20,22,0.12)]"
    >
      {pending ? <Spinner /> : children}
    </button>
  );
}

type ButtonProps = Omit<React.ComponentProps<"button">, "className"> & {
  pending?: boolean;
  variant?: "primary" | "secondary";
};

/** Generic secondary/primary action button — used outside <form> submit flows
 * (e.g. settings page actions) so those files don't hand-roll their own class
 * strings. */
export function Button({
  pending,
  disabled,
  children,
  variant = "secondary",
  type = "button",
  ...props
}: ButtonProps) {
  const classes =
    variant === "primary"
      ? "flex h-11 items-center justify-center gap-2 rounded-[8px] bg-accent px-4 text-sm font-semibold text-accent-on transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
      : "flex h-11 items-center justify-center gap-2 rounded-[8px] border border-border bg-surface px-4 text-sm font-semibold text-text-primary transition hover:bg-surface-subtle hover:border-border-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60";

  return (
    <button
      type={type}
      disabled={disabled ?? pending}
      className={classes}
      {...props}
    >
      {pending ? <Spinner /> : children}
    </button>
  );
}

type PasskeyButtonProps = Omit<
  React.ComponentProps<"button">,
  "type" | "className"
> & {
  pending?: boolean;
};

export function PasskeyButton({
  pending,
  disabled,
  children,
  ...props
}: PasskeyButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled ?? pending}
      className="flex h-11 w-full px-4 items-center justify-center gap-2 rounded-[8px] border border-border bg-surface text-[15px] font-semibold text-text-primary transition hover:bg-surface-subtle hover:border-border-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
      {...props}
    >
      {pending ? (
        <Spinner />
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-[17px] w-[17px] text-accent"
          aria-hidden
        >
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 19c0-3 2.9-5 6.5-5" />
          <path d="M17 10.5a2.5 2.5 0 0 1 2.5 2.5v1M14.5 14h5v6h-5z" />
        </svg>
      )}
      {children}
    </button>
  );
}

export function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3.5">
      <span className="h-px flex-1 bg-border-hairline" />
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-tertiary">
        {children}
      </span>
      <span className="h-px flex-1 bg-border-hairline" />
    </div>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full rounded-[10px] border border-border-card bg-surface p-8 shadow-sm">
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-6 space-y-2">
      <h1 className="text-[26px] font-bold leading-8 tracking-[-0.03em] text-text-primary">
        {title}
      </h1>
      <p className="text-[15px] leading-6 text-text-muted">{subtitle}</p>
    </div>
  );
}

export function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        className="opacity-25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </svg>
  );
}
