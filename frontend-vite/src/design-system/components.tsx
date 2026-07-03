import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import "./tokens.css";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className = "", variant = "secondary", ...props }: ButtonProps) {
  return <button className={`rw-button rw-button-${variant} ${className}`.trim()} {...props} />;
}

type CardProps = {
  children: ReactNode;
  className?: string;
  variant?: "default" | "hero" | "subtle" | "flat";
};

export function Card({ children, className = "", variant = "default" }: CardProps) {
  return <div className={`rw-card rw-card-${variant} ${className}`.trim()}>{children}</div>;
}

type SearchInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  action: ReactNode;
  note?: ReactNode;
};

export function SearchInput({ label, action, note, className = "", ...props }: SearchInputProps) {
  return (
    <div className={`rw-search ${className}`.trim()}>
      <label htmlFor={props.id}>{label}</label>
      <div className="rw-search-row">
        <input {...props} />
        {action}
      </div>
      {note && <div className="rw-search-note">{note}</div>}
    </div>
  );
}

type BadgeProps = {
  children: ReactNode;
  tone?: "info" | "success" | "neutral" | "warning";
  className?: string;
};

export function Badge({ children, tone = "neutral", className = "" }: BadgeProps) {
  return <span className={`rw-badge rw-badge-${tone} ${className}`.trim()}>{children}</span>;
}

type SectionHeaderProps = {
  eyebrow?: ReactNode;
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function SectionHeader({ eyebrow, title, action, className = "" }: SectionHeaderProps) {
  return (
    <div className={`rw-section-header ${className}`.trim()}>
      <div>
        {eyebrow && <p className="rw-eyebrow">{eyebrow}</p>}
        {title && <h2>{title}</h2>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

type EmptyStateProps = {
  title: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, children, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`rw-empty ${className}`.trim()}>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}

type LoadingStateProps = {
  message: string;
  className?: string;
};

export function LoadingState({ message, className = "" }: LoadingStateProps) {
  return (
    <div className={`rw-loading ${className}`.trim()} role="status" aria-live="polite">
      <span>{message}</span>
      <div className="rw-loading-card" aria-hidden="true">
        <div className="rw-skeleton rw-skeleton-logo" />
        <div className="rw-skeleton-stack">
          <div className="rw-skeleton rw-skeleton-title" />
          <div className="rw-skeleton rw-skeleton-line" />
          <div className="rw-skeleton rw-skeleton-line short" />
        </div>
      </div>
    </div>
  );
}
