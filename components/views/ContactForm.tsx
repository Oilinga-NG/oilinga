"use client";

import { type FormEvent, useState } from "react";
import { Icon } from "@/components/ui/Icon";

type Status = "idle" | "sending" | "sent" | "error";

const subjects = [
    "General enquiry",
    "Buyer support",
    "Seller / listing enquiry",
    "Partnership or press",
    "Report an issue",
    "Other",
];

export function ContactForm() {
    const [status, setStatus] = useState<Status>("idle");
    const [values, setValues] = useState({
        name: "",
        email: "",
        subject: "",
        message: "",
    });
    const [errors, setErrors] = useState<Partial<typeof values>>({});

    function update(field: keyof typeof values, value: string) {
        setValues((v) => ({ ...v, [field]: value }));
        setErrors((e) => ({ ...e, [field]: undefined }));
    }

    function validate() {
        const next: Partial<typeof values> = {};
        if (!values.name.trim()) next.name = "Please enter your name.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
            next.email = "Enter a valid email address.";
        if (!values.subject) next.subject = "Please choose a subject.";
        if (values.message.trim().length < 10)
            next.message = "Please write at least a sentence so we can help you.";
        return next;
    }

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length) { setErrors(errs); return; }
        setStatus("sending");
        // Simulate network delay — replace with a real API call when ready
        window.setTimeout(() => {
            setStatus("sent");
            setValues({ name: "", email: "", subject: "", message: "" });
        }, 1200);
    }

    if (status === "sent") {
        return (
            <div className="oi-contact-form__sent" role="status">
                <span className="oi-contact-form__sent-icon" aria-hidden="true">
                    <Icon name="check" size={28} strokeWidth={2.5} />
                </span>
                <div>
                    <strong>Message sent — thank you!</strong>
                    <p>We'll get back to you within one business day.</p>
                </div>
                <button
                    type="button"
                    className="oi-btn oi-btn--outline oi-btn--sm"
                    onClick={() => setStatus("idle")}
                >
                    Send another message
                </button>
            </div>
        );
    }

    return (
        <form
            className="oi-contact-form"
            onSubmit={handleSubmit}
            noValidate
            aria-label="Contact form"
        >
            <div className="oi-contact-form__row">
                {/* Name */}
                <div className="oi-field">
                    <label className="oi-field__label" htmlFor="cf-name">Full name</label>
                    <input
                        id="cf-name"
                        className="oi-input"
                        type="text"
                        autoComplete="name"
                        placeholder="Amina Okafor"
                        value={values.name}
                        onChange={(e) => update("name", e.target.value)}
                        aria-invalid={Boolean(errors.name)}
                        aria-describedby={errors.name ? "cf-name-err" : undefined}
                    />
                    {errors.name && <small className="oi-field__error" id="cf-name-err">{errors.name}</small>}
                </div>

                {/* Email */}
                <div className="oi-field">
                    <label className="oi-field__label" htmlFor="cf-email">Email address</label>
                    <input
                        id="cf-email"
                        className="oi-input"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={values.email}
                        onChange={(e) => update("email", e.target.value)}
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={errors.email ? "cf-email-err" : undefined}
                    />
                    {errors.email && <small className="oi-field__error" id="cf-email-err">{errors.email}</small>}
                </div>
            </div>

            {/* Subject */}
            <div className="oi-field">
                <label className="oi-field__label" htmlFor="cf-subject">Subject</label>
                <select
                    id="cf-subject"
                    className="oi-input oi-input--select"
                    value={values.subject}
                    onChange={(e) => update("subject", e.target.value)}
                    aria-invalid={Boolean(errors.subject)}
                    aria-describedby={errors.subject ? "cf-subject-err" : undefined}
                >
                    <option value="">Choose a subject…</option>
                    {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {errors.subject && <small className="oi-field__error" id="cf-subject-err">{errors.subject}</small>}
            </div>

            {/* Message */}
            <div className="oi-field">
                <label className="oi-field__label" htmlFor="cf-message">Message</label>
                <textarea
                    id="cf-message"
                    className="oi-input oi-input--textarea"
                    rows={5}
                    placeholder="How can we help you?"
                    value={values.message}
                    onChange={(e) => update("message", e.target.value)}
                    aria-invalid={Boolean(errors.message)}
                    aria-describedby={errors.message ? "cf-message-err" : undefined}
                />
                {errors.message && <small className="oi-field__error" id="cf-message-err">{errors.message}</small>}
            </div>

            {status === "error" && (
                <p className="oi-auth__error" role="alert">
                    Something went wrong. Please try again or email us directly.
                </p>
            )}

            <button
                type="submit"
                className="oi-btn oi-btn--primary oi-btn--lg"
                disabled={status === "sending"}
                aria-busy={status === "sending"}
            >
                {status === "sending" ? (
                    <>Sending…</>
                ) : (
                    <>Send message <Icon name="arrow-right" size={16} /></>
                )}
            </button>
        </form>
    );
}
