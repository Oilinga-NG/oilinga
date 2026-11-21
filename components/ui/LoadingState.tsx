"use client";

export function LoadingState({ label = "Loading", variant = "page" }: { label?: string; variant?: "page" | "inline" }) {
    return (
        <span className={`oi-loading oi-loading--${variant}`} role="status" aria-live="polite">
            <span className="oi-loading__surface" aria-hidden="true">
                <span className="oi-loading__spinner" />
                <span className="oi-loading__line oi-loading__line--long" />
                <span className="oi-loading__line oi-loading__line--short" />
            </span>
            <span className="oi-loading__label">{label}</span>
        </span>
    );
}
