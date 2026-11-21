import Link from "next/link";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Icon } from "@/components/ui/Icon";
import { ContactForm } from "@/components/views/ContactForm";

/* --------------------------------------------------------------------------
   Static data
   -------------------------------------------------------------------------- */

const stats = [
    { value: "12,000+", label: "Registered buyers" },
    { value: "480+", label: "Verified sellers" },
    { value: "6", label: "Countries served" },
    { value: "₦2.4bn+", label: "Traded on platform" },
];

const values = [
    {
        icon: "shield" as const,
        title: "Trust first",
        body: "Every seller goes through a verification process before they can list products. Buyers can purchase knowing who they are buying from.",
    },
    {
        icon: "leaf" as const,
        title: "Rooted locally",
        body: "We are built for African producers and buyers. Our pricing, logistics and support are designed around how trade actually works here.",
    },
    {
        icon: "drop" as const,
        title: "Quality you can taste",
        body: "From crude red palm oil pressed on the farm to refined kitchen-ready oil, every product on Oilinga meets a minimum quality standard.",
    },
    {
        icon: "truck" as const,
        title: "Reliable delivery",
        body: "We work with vetted logistics partners so orders arrive on time, every time — whether across a city or across borders.",
    },
    {
        icon: "store" as const,
        title: "Sellers grow here",
        body: "Tools for inventory, orders, earnings and analytics mean that a producer in a village can run a professional business from their phone.",
    },
    {
        icon: "headset" as const,
        title: "Real support",
        body: "Our team is reachable by phone, chat and email. We speak the languages of our markets and understand the challenges of local trade.",
    },
];

const contacts = [
    {
        icon: "mail" as const,
        title: "Email us",
        detail: "hello@oilinga.com",
        href: "mailto:hello@oilinga.com",
        label: "Send a message",
    },
    {
        icon: "headset" as const,
        title: "Talk to support",
        detail: "+234 800 OIL ING",
        href: "tel:+2348006454646",
        label: "Call us",
    },
    {
        icon: "store" as const,
        title: "Seller enquiries",
        detail: "sellers@oilinga.com",
        href: "mailto:sellers@oilinga.com",
        label: "Get in touch",
    },
    {
        icon: "pin" as const,
        title: "Head office",
        detail: "Lagos, Nigeria",
        href: "https://maps.google.com/?q=Lagos,Nigeria",
        label: "View on map",
    },
];

const steps = [
    {
        num: "01",
        title: "Create your account",
        body: "Sign up as a buyer or seller in under two minutes. No paperwork, no fees to get started.",
    },
    {
        num: "02",
        title: "Browse or list products",
        body: "Buyers explore hundreds of verified listings. Sellers publish their shop and start reaching new customers immediately.",
    },
    {
        num: "03",
        title: "Order securely",
        body: "Checkout is protected. Pay by card, bank transfer or on delivery — your choice.",
    },
    {
        num: "04",
        title: "Track and grow",
        body: "Follow your order in real time. Sellers manage inventory, track earnings and read reviews — all in one dashboard.",
    },
];

const team = [
    { initials: "AO", name: "Amina Okafor", role: "Co-founder & CEO", color: "palm" },
    { initials: "KM", name: "Kwame Mensah", role: "Co-founder & CTO", color: "kernel" },
    { initials: "FE", name: "Fatima El-Amin", role: "Head of Seller Success", color: "groundnut" },
    { initials: "DN", name: "David Nwosu", role: "Head of Logistics", color: "refined" },
];

const faqs = [
    {
        q: "Is Oilinga free to use as a buyer?",
        a: "Yes — browsing, searching and purchasing are completely free for buyers. You only pay for the products you order.",
    },
    {
        q: "How do I become a verified seller?",
        a: "Create a seller account, submit your business details and a government-issued ID. Our team reviews applications within 48 hours.",
    },
    {
        q: "Which countries does Oilinga serve?",
        a: "We currently operate in Nigeria, Ghana, Côte d'Ivoire, Cameroon, Senegal and Kenya, with more markets launching this year.",
    },
    {
        q: "How are payments protected?",
        a: "Funds are held securely until delivery is confirmed. If a problem arises, our buyer protection policy covers your order.",
    },
];

/* --------------------------------------------------------------------------
   Component
   -------------------------------------------------------------------------- */

export function AboutView() {
    return (
        <div className="oi-view oi-container oi-about-page" aria-labelledby="about-title">

            {/* ── Page heading ───────────────────────────────────────────── */}
            <div className="oi-about-page__head">
                <span className="oi-eyebrow oi-eyebrow--green">Rooted in Africa. Growing together.</span>
                <h1 id="about-title" className="oi-about-page__title">
                    A marketplace built to help<br />
                    every <em>harvest thrive.</em>
                </h1>
                <p className="oi-about-page__lede">
                    Oilinga connects palm oil and groundnut oil producers, retailers and
                    consumers across Africa through a trusted, easy-to-use marketplace.
                </p>
            </div>

            {/* ── Stats ──────────────────────────────────────────────────── */}
            <section className="oi-about-stats" aria-label="Platform statistics">
                {stats.map((stat) => (
                    <div key={stat.label} className="oi-about-stats__item">
                        <strong>{stat.value}</strong>
                        <span>{stat.label}</span>
                    </div>
                ))}
            </section>

            {/* ── Mission ────────────────────────────────────────────────── */}
            <section className="oi-about-mission oi-section" aria-labelledby="mission-title">
                <div className="oi-about-mission__text">
                    <span className="oi-eyebrow oi-eyebrow--green">Our mission</span>
                    <h2 id="mission-title" className="oi-section__title">
                        Making quality African oils<br />accessible to everyone.
                    </h2>
                    <p>
                        Africa produces more than 50% of the world's palm oil, yet millions of
                        small producers struggle to reach buyers beyond their local market.
                        Meanwhile, retailers and consumers pay more because supply chains are
                        fragmented and opaque.
                    </p>
                    <p>
                        Oilinga was founded to fix that. We built a marketplace where producers
                        list directly, buyers compare and purchase with confidence, and everyone
                        — from a Lagos restaurant to a Nairobi wholesaler — gets a fair deal.
                    </p>
                    <ul className="oi-about-mission__list">
                        {[
                            "Direct producer-to-buyer connections",
                            "Transparent pricing with no hidden fees",
                            "Verified seller badges for every shop",
                            "Buyer protection on every order",
                        ].map((point) => (
                            <li key={point}>
                                <Icon name="check" size={15} strokeWidth={2.5} />
                                {point}
                            </li>
                        ))}
                    </ul>
                    <ButtonLink href="/marketplace" variant="primary" className="oi-about-mission__cta">
                        Explore the marketplace
                        <Icon name="arrow-right" size={15} />
                    </ButtonLink>
                </div>
                <div className="oi-about-mission__visual">
                    <div className="oi-about-mission__card oi-about-mission__card--top">
                        <span className="oi-about-mission__card-icon" aria-hidden="true">🫙</span>
                        <div>
                            <strong>Fresh Crude Palm Oil</strong>
                            <small>Palm Harvest Foods · Lagos</small>
                        </div>
                        <span className="oi-badge oi-badge--green">Verified</span>
                    </div>
                    <div className="oi-about-mission__card oi-about-mission__card--mid">
                        <span className="oi-about-mission__card-icon" aria-hidden="true">🥜</span>
                        <div>
                            <strong>Cold-Pressed Groundnut Oil</strong>
                            <small>Adeola Farms · Ogun State</small>
                        </div>
                        <span className="oi-badge oi-badge--gold">Bestseller</span>
                    </div>
                    <div className="oi-about-mission__card oi-about-mission__card--bot">
                        <span className="oi-about-mission__card-icon" aria-hidden="true">🧴</span>
                        <div>
                            <strong>Golden Refined Oil</strong>
                            <small>Mama Esi Oils · Accra</small>
                        </div>
                        <span className="oi-badge oi-badge--neutral">Top rated</span>
                    </div>
                </div>
            </section>

            {/* ── How it works ───────────────────────────────────────────── */}
            <section className="oi-about-how oi-section" aria-labelledby="how-title">
                <div className="oi-section__head">
                    <div>
                        <span className="oi-eyebrow oi-eyebrow--green">Simple by design</span>
                        <h2 id="how-title" className="oi-section__title">How Oilinga works</h2>
                    </div>
                </div>
                <div className="oi-about-how__grid">
                    {steps.map((step) => (
                        <div key={step.num} className="oi-about-how__step">
                            <span className="oi-about-how__num" aria-hidden="true">{step.num}</span>
                            <h3 className="oi-about-how__step-title">{step.title}</h3>
                            <p className="oi-about-how__step-body">{step.body}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Values ─────────────────────────────────────────────────── */}
            <section className="oi-about-values oi-section" aria-labelledby="values-title">
                <div className="oi-section__head">
                    <div>
                        <span className="oi-eyebrow oi-eyebrow--green">What we stand for</span>
                        <h2 id="values-title" className="oi-section__title">Our values</h2>
                    </div>
                </div>
                <div className="oi-about-values__grid">
                    {values.map((v) => (
                        <div key={v.title} className="oi-about-values__card">
                            <span className="oi-about-values__icon" aria-hidden="true">
                                <Icon name={v.icon} size={22} strokeWidth={1.6} />
                            </span>
                            <h3 className="oi-about-values__title">{v.title}</h3>
                            <p className="oi-about-values__body">{v.body}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Quote / Story pull ─────────────────────────────────────── */}
            <section className="oi-about-quote oi-section" aria-label="Founder quote">
                <blockquote className="oi-about-quote__block">
                    <p>
                        "We started Oilinga because we watched brilliant producers sell
                        below their worth every season — not because their product wasn't
                        good enough, but because they had no easy way to reach the right
                        buyers. That is the problem we exist to solve."
                    </p>
                    <footer>
                        <cite>
                            <strong>Amina Okafor</strong>
                            <span>Co-founder &amp; CEO, Oilinga</span>
                        </cite>
                    </footer>
                </blockquote>
            </section>

            {/* ── Team ───────────────────────────────────────────────────── */}
            <section className="oi-about-team oi-section" aria-labelledby="team-title">
                <div className="oi-section__head">
                    <div>
                        <span className="oi-eyebrow oi-eyebrow--green">The people behind Oilinga</span>
                        <h2 id="team-title" className="oi-section__title">Meet the team</h2>
                    </div>
                </div>
                <div className="oi-about-team__grid">
                    {team.map((member) => (
                        <div key={member.name} className="oi-about-team__card">
                            <span
                                className={`oi-about-team__avatar oi-shop-card__mark--${member.color}`}
                                aria-hidden="true"
                            >
                                {member.initials}
                            </span>
                            <strong className="oi-about-team__name">{member.name}</strong>
                            <span className="oi-about-team__role">{member.role}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── FAQ ────────────────────────────────────────────────────── */}
            <section className="oi-about-faq oi-section" aria-labelledby="faq-title">
                <div className="oi-section__head">
                    <div>
                        <span className="oi-eyebrow oi-eyebrow--green">Got questions?</span>
                        <h2 id="faq-title" className="oi-section__title">Frequently asked</h2>
                    </div>
                </div>
                <div className="oi-about-faq__grid">
                    {faqs.map((faq) => (
                        <div key={faq.q} className="oi-about-faq__item">
                            <h3 className="oi-about-faq__q">{faq.q}</h3>
                            <p className="oi-about-faq__a">{faq.a}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Get in touch ───────────────────────────────────────────── */}
            <section className="oi-about-contact oi-section" aria-labelledby="contact-title">
                <div className="oi-section__head">
                    <div>
                        <span className="oi-eyebrow oi-eyebrow--green">We'd love to hear from you</span>
                        <h2 id="contact-title" className="oi-section__title">Get in touch</h2>
                    </div>
                </div>
                <div className="oi-about-contact__grid">
                    {contacts.map((c) => (
                        <a
                            key={c.title}
                            href={c.href}
                            className="oi-about-contact__card"
                            target={c.href.startsWith("http") ? "_blank" : undefined}
                            rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                        >
                            <span className="oi-about-contact__icon" aria-hidden="true">
                                <Icon name={c.icon} size={22} strokeWidth={1.6} />
                            </span>
                            <div className="oi-about-contact__text">
                                <strong>{c.title}</strong>
                                <span>{c.detail}</span>
                            </div>
                            <span className="oi-about-contact__arrow" aria-hidden="true">
                                <Icon name="arrow-right" size={16} />
                            </span>
                        </a>
                    ))}
                </div>
            </section>

            {/* ── Contact form ───────────────────────────────────────────── */}
            <section className="oi-about-form-section oi-section" aria-labelledby="form-title">
                <div className="oi-about-form-section__inner">
                    <div className="oi-about-form-section__copy">
                        <span className="oi-eyebrow oi-eyebrow--green">Send us a message</span>
                        <h2 id="form-title" className="oi-section__title">
                            We read every message
                        </h2>
                        <p>
                            Fill in the form and a member of our team will get back to you
                            within one business day. For urgent seller issues call us directly.
                        </p>
                        <ul className="oi-about-form-section__list">
                            <li><Icon name="check" size={14} strokeWidth={2.5} />Response within 1 business day</li>
                            <li><Icon name="check" size={14} strokeWidth={2.5} />Available in English, Yoruba &amp; Hausa</li>
                            <li><Icon name="check" size={14} strokeWidth={2.5} />Dedicated seller support line</li>
                        </ul>
                    </div>
                    <ContactForm />
                </div>
            </section>

            {/* ── Bottom CTA ─────────────────────────────────────────────── */}
            <section className="oi-about-cta" aria-labelledby="cta-title">
                <span className="oi-eyebrow">Ready to get started?</span>
                <h2 id="cta-title" className="oi-about-cta__title">
                    Join thousands of buyers and<br />sellers across Africa.
                </h2>
                <p className="oi-about-cta__lede">
                    Whether you are looking for quality oils or ready to grow your business,
                    Oilinga is the place to do it.
                </p>
                <div className="oi-about-cta__actions">
                    <ButtonLink href="/marketplace" variant="gold" size="lg">
                        Start shopping
                        <Icon name="arrow-right" size={16} />
                    </ButtonLink>
                    <ButtonLink href="/seller" variant="glass" size="lg">
                        Open your shop
                        <Icon name="store" size={16} />
                    </ButtonLink>
                </div>
            </section>

        </div>
    );
}
