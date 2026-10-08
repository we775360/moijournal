import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { absoluteUrl, SITE_URL } from "@/lib/site";

const TITLE = "MoiJournal — your cosy, private online diary";
const DESC =
  "Write the sweet stuff and the harsh stuff. MoiJournal is a cute, end-to-end encrypted diary with scribbles, signatures and beautiful PDF exports.";
// Words people actually search for when they look for a diary: "online diary", "journal
// app", "private diary". Kept honest — every phrase here is something the site really is.
const KEYWORDS =
  "moijournal, online diary, private diary, encrypted diary, digital diary, diary app, journal app, online journal, write diary online, free online diary, secure diary, keep a diary online";

const FAQ = [
  {
    q: "Is MoiJournal a private online diary?",
    a: "Yes. Every page is encrypted on your own device before it is uploaded, so our servers only ever hold scrambled ciphertext. Not even we can read what you wrote.",
  },
  {
    q: "Can I keep a diary online for free?",
    a: "Yes. The free plan gives you 2 journal books and 10 pages, no card needed. Premium is ₹99 a month for 10 books and 50 pages.",
  },
  {
    q: "Does MoiJournal work on my phone?",
    a: "It works in any modern browser — iPhone, Android, tablet, laptop or desktop — and you can add it to your home screen so it feels just like a diary app.",
  },
  {
    q: "What if I forget my password?",
    a: "Signup gives you a one-time recovery code. Keep it somewhere safe, because it is the only other key to your diary. Lose both and your diary cannot be recovered — by design.",
  },
];

// Rich results: tells Google this is a real web app (with pricing) rather than just a page.
const STRUCTURED_DATA = [
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "MoiJournal",
    url: SITE_URL,
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Any modern web browser",
    description: DESC,
    inLanguage: "en",
    offers: [
      { "@type": "Offer", name: "Free", price: "0", priceCurrency: "INR" },
      { "@type": "Offer", name: "Premium", price: "99", priceCurrency: "INR" },
    ],
    featureList: [
      "End-to-end encrypted diary pages",
      "Bookshelf of journal books with photo covers",
      "Finger, mouse and pen scribble pad",
      "Signature pad",
      "Print-ready PDF export",
      "Personal themes",
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "MoiJournal",
    url: SITE_URL,
    inLanguage: "en",
  },
];

const FAQ_DATA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { name: "keywords", content: KEYWORDS },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absoluteUrl("/") },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/") }],
  }),
  component: Landing,
});

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      { threshold: 0.15 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function Landing() {
  useReveal();
  return (
    <div className="overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_DATA) }}
      />
      <Nav />
      <Hero />
      <Marquee />
      <HowItWorks />
      <Features />
      <Privacy />
      <Pricing />
      <Questions />
      <Footer />
    </div>
  );
}

function Btn({
  children,
  variant = "primary",
  to = "/signup",
}: {
  children: ReactNode;
  variant?: "primary" | "ghost";
  to?: "/signup" | "/login";
}) {
  const base =
    "inline-flex items-center gap-2 rounded-full px-6 py-3 font-display font-bold transition-transform hover:-translate-y-0.5 active:translate-y-0.5";
  return (
    <Link
      to={to}
      className={
        variant === "primary"
          ? `${base} sticker bg-primary text-primary-foreground`
          : `${base} border-2 border-ink bg-paper text-ink`
      }
    >
      {children}
    </Link>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b-2 border-ink bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <a href="/" className="flex items-center gap-2">
          <span className="sticker grid h-9 w-9 place-items-center rounded-xl bg-blush font-hand text-2xl text-ink">
            m
          </span>
          <span className="font-display text-xl font-extrabold text-ink">MoiJournal</span>
        </a>
        <nav className="hidden gap-7 text-sm font-semibold text-ink md:flex">
          <a href="#how" className="hover:text-primary">
            How it works
          </a>
          <a href="#privacy" className="hover:text-primary">
            Privacy
          </a>
          <a href="#pricing" className="hover:text-primary">
            Pricing
          </a>
          <Link to="/get-app" className="hover:text-primary">
            Get the app
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="hidden rounded-full px-4 py-2 text-sm font-bold text-ink hover:bg-muted sm:block"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="sticker rounded-full bg-butter px-4 py-2 text-sm font-bold text-ink"
          >
            Sign up
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 md:grid-cols-2 md:pt-20">
      <div className="rise">
        <p className="font-hand text-2xl text-primary">dear diary,</p>
        <h1 className="mt-2 text-5xl font-extrabold leading-[1.02] text-ink md:text-7xl">
          Spill it all.
          <br />
          <span className="relative inline-block">
            We'll keep it
            <svg
              className="scribble absolute -bottom-3 left-0 w-full"
              viewBox="0 0 300 20"
              fill="none"
            >
              <path
                d="M2 14 C 60 2, 120 20, 180 8 S 270 4, 298 12"
                stroke="var(--primary)"
                strokeWidth="5"
                strokeLinecap="round"
              />
            </svg>
          </span>{" "}
          safe.
        </h1>
        <p className="mt-6 max-w-md text-lg text-muted-foreground">
          The sweet days, the messy days, the "ugh" days. MoiJournal is a cosy little diary that
          lives in your pocket, locked so tight even we can't peek.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Btn>Start my diary — free</Btn>
          <a
            href="#how"
            className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-paper px-6 py-3 font-display font-bold text-ink transition-transform hover:-translate-y-0.5"
          >
            See how it works
          </a>
        </div>
        <p className="mt-5 font-hand text-xl text-muted-foreground">
          ✿ no card needed · works on any device
        </p>
      </div>
      <BookArt />
    </section>
  );
}

function BookArt() {
  return (
    <div className="relative mx-auto h-[420px] w-full max-w-[460px]">
      <span
        className="float absolute -left-2 top-4 z-20 rotate-[-8deg] rounded-lg bg-butter px-3 py-1 font-hand text-xl text-ink sticker"
        style={{ ["--r" as string]: "-8deg" }}
      >
        today was good :)
      </span>
      <span
        className="float absolute -right-1 bottom-10 z-20 rounded-full bg-sage px-3 py-1 font-hand text-xl text-ink sticker"
        style={{ animationDelay: "1.2s" }}
      >
        🔒 encrypted
      </span>
      {/* open page */}
      <div className="sticker ruled absolute inset-y-6 left-[18%] right-[4%] rounded-r-2xl rounded-l-md p-6 pl-8">
        <p className="font-hand text-lg text-muted-foreground">Wed, 7 Oct · 9:41 pm</p>
        <p className="mt-2 font-hand text-2xl leading-8 text-ink">
          Finally told her how I felt. Hands were shaking but I did it!!
        </p>
        <svg className="scribble mt-4 h-16 w-40" viewBox="0 0 160 60" fill="none">
          <path
            d="M5 40 C 20 5, 35 55, 50 25 S 80 50, 95 20 S 130 45, 155 15"
            stroke="var(--ink)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
        <p className="absolute bottom-6 right-6 font-hand text-2xl text-primary">— me ♡</p>
      </div>
      {/* cover that flips open */}
      <div className="cover-open sticker absolute inset-y-6 left-[18%] right-[4%] z-10 flex flex-col items-center justify-center rounded-2xl bg-blush">
        <div className="rounded-xl border-2 border-dashed border-ink px-6 py-4 text-center">
          <p className="font-display text-3xl font-extrabold text-ink">My Diary</p>
          <p className="font-hand text-xl text-ink">vol. 1</p>
        </div>
      </div>
    </div>
  );
}

function Marquee() {
  const words = [
    "crushes",
    "rants",
    "gratitude",
    "dreams",
    "bad days",
    "tiny wins",
    "secrets",
    "doodles",
  ];
  return (
    <div className="border-y-2 border-ink bg-ink py-3 text-paper">
      <div className="flex gap-10 whitespace-nowrap font-hand text-2xl [animation:marq_25s_linear_infinite]">
        {[...words, ...words, ...words].map((w, i) => (
          <span key={i}>✦ {w}</span>
        ))}
      </div>
      <style>{`@keyframes marq{to{transform:translateX(-33.33%)}}`}</style>
    </div>
  );
}

function Section({
  id,
  kicker,
  title,
  children,
}: {
  id?: string;
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
      <div className="reveal mb-12 max-w-2xl">
        <p className="font-hand text-2xl text-primary">{kicker}</p>
        <h2 className="text-4xl font-extrabold text-ink md:text-5xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      t: "Make it yours",
      d: "Pick a name, a theme that feels like you, and a secret password.",
      c: "bg-blush",
    },
    {
      n: "02",
      t: "Grab a book",
      d: "Create a journal book, upload any cover you love.",
      c: "bg-butter",
    },
    {
      n: "03",
      t: "Write, doodle, sign",
      d: "Date & time fill themselves in. Scribble in the margins. Sign it off.",
      c: "bg-sage",
    },
    {
      n: "04",
      t: "Keep it forever",
      d: "Export the whole book as a gorgeous, print-ready PDF.",
      c: "bg-sky",
    },
  ];
  return (
    <Section id="how" kicker="it's really this simple" title="How MoiJournal works">
      <div className="grid gap-6 md:grid-cols-4">
        {steps.map((s, i) => (
          <div
            key={s.n}
            className={`reveal sticker rounded-2xl ${s.c} p-6`}
            style={{ transitionDelay: `${i * 120}ms`, rotate: `${[-1.5, 1, -0.5, 1.5][i]}deg` }}
          >
            <p className="font-display text-4xl font-extrabold text-ink/40">{s.n}</p>
            <h3 className="mt-3 text-xl font-bold text-ink">{s.t}</h3>
            <p className="mt-2 text-ink/80">{s.d}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Features() {
  return (
    <Section kicker="little things, lots of love" title="A diary that feels like paper">
      <div className="grid gap-6 md:grid-cols-3">
        <div className="reveal sticker ruled rounded-2xl p-6 md:col-span-2">
          <h3 className="text-2xl font-bold text-ink">Write like it's your notebook</h3>
          <p className="mt-2 max-w-md text-muted-foreground">
            Lined pages, auto date & time (change it whenever), moods, and a writing space that
            never gets in the way.
          </p>
          <p className="mt-6 font-hand text-3xl leading-8 text-ink">
            I can't believe it rained on the one day I wore white shoes 😭
          </p>
        </div>
        <div
          className="reveal sticker rounded-2xl bg-paper p-6"
          style={{ transitionDelay: "120ms" }}
        >
          <h3 className="text-2xl font-bold text-ink">Scribble anywhere</h3>
          <p className="mt-2 text-muted-foreground">Draw with your finger, mouse or pen.</p>
          <svg viewBox="0 0 200 100" className="mt-4 w-full" fill="none">
            <path
              d="M20 70 Q 40 10 70 60 T 120 50 Q 150 20 180 70"
              stroke="var(--primary)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle cx="160" cy="25" r="12" stroke="var(--ink)" strokeWidth="3" />
          </svg>
        </div>
        <div
          className="reveal sticker rounded-2xl bg-butter p-6"
          style={{ transitionDelay: "80ms" }}
        >
          <h3 className="text-2xl font-bold text-ink">Sign it off</h3>
          <p className="mt-2 text-ink/80">Add your own signature to any page.</p>
          <p className="mt-4 font-hand text-5xl text-ink">G. Singh</p>
        </div>
        <div
          className="reveal sticker rounded-2xl bg-blush p-6 md:col-span-2"
          style={{ transitionDelay: "160ms" }}
        >
          <h3 className="text-2xl font-bold text-ink">Your bookshelf, your cover</h3>
          <p className="mt-2 text-ink/80">
            Upload any photo as a book cover. Rearrange your shelf. Make it cute.
          </p>
          <div className="mt-5 flex gap-3">
            {["bg-sage", "bg-sky", "bg-butter", "bg-paper"].map((c, i) => (
              <div
                key={c}
                className={`sticker h-24 w-16 rounded-md ${c}`}
                style={{ rotate: `${(i - 1.5) * 4}deg` }}
              />
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

function Privacy() {
  const points = [
    [
      "Locked on your device",
      "Every page is encrypted before it ever leaves your phone or laptop.",
    ],
    [
      "We can't read it. Ever.",
      "Our servers only hold scrambled data. No staff, no hacker, no one.",
    ],
    ["PDFs made at home", "Your PDF is built right in your browser — your words never travel."],
    ["No ads, no tracking", "We don't sell, share or analyse what you write. It's your diary."],
  ];
  return (
    <section id="privacy" className="scroll-mt-20 border-y-2 border-ink bg-ink py-24 text-paper">
      <div className="mx-auto max-w-6xl px-5">
        <div className="reveal max-w-2xl">
          <p className="font-hand text-2xl text-blush">pinky promise</p>
          <h2 className="text-4xl font-extrabold md:text-5xl">
            Cute on the outside. A vault on the inside.
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {points.map(([t, d], i) => (
            <div
              key={t}
              className="reveal rounded-2xl border-2 border-paper/30 p-6"
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <h3 className="text-xl font-bold">🔐 {t}</h3>
              <p className="mt-2 text-paper/75">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <Section id="pricing" kicker="small team, honest prices" title="Pick your notebook">
      <div className="grid gap-8 md:grid-cols-2">
        <Plan
          name="Free"
          price="₹0"
          note="forever"
          items={[
            "2 journal books",
            "10 pages",
            "Scribbles & signatures",
            "PDF export",
            "Full encryption",
          ]}
          cta="Start free"
          color="bg-paper"
        />
        <Plan
          name="Premium"
          price="₹99"
          note="/ month"
          items={[
            "10 journal books",
            "50 pages",
            "Everything in Free",
            "Custom covers galore",
            "Support a tiny team ♡",
          ]}
          cta="Go Premium"
          color="bg-butter"
          badge
        />
      </div>
      <p className="mt-10 text-center font-hand text-2xl text-muted-foreground">
        Premium is paid by UPI — ₹99 through any UPI app, no card, no auto-renew.
      </p>
    </Section>
  );
}

function Plan({
  name,
  price,
  note,
  items,
  cta,
  color,
  badge,
}: {
  name: string;
  price: string;
  note: string;
  items: string[];
  cta: string;
  color: string;
  badge?: boolean;
}) {
  return (
    <div className={`reveal sticker relative rounded-3xl ${color} p-8`}>
      {badge && (
        <span className="sticker absolute -top-4 right-6 rotate-3 rounded-full bg-blush px-3 py-1 font-hand text-xl text-ink">
          most loved
        </span>
      )}
      <h3 className="text-2xl font-bold text-ink">{name}</h3>
      <p className="mt-3 text-ink">
        <span className="font-display text-5xl font-extrabold">{price}</span>{" "}
        <span className="text-muted-foreground">{note}</span>
      </p>
      <ul className="mt-6 space-y-2 text-ink">
        {items.map((i) => (
          <li key={i}>✓ {i}</li>
        ))}
      </ul>
      <div className="mt-8">
        <Btn>{cta}</Btn>
      </div>
    </div>
  );
}

function Questions() {
  return (
    <Section id="faq" kicker="you asked, we answered" title="MoiJournal, in plain words">
      <div className="grid gap-6 md:grid-cols-2">
        {FAQ.map(({ q, a }, i) => (
          <div
            key={q}
            className="reveal sticker rounded-2xl bg-paper p-6"
            style={{ transitionDelay: `${i * 100}ms` }}
          >
            <h3 className="text-xl font-bold text-ink">{q}</h3>
            <p className="mt-2 text-muted-foreground">{a}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Footer() {
  return (
    <footer className="border-t-2 border-ink">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 sm:flex-row">
        <p className="font-display font-extrabold text-ink">MoiJournal</p>
        <p className="font-elegant text-lg font-semibold italic tracking-wide text-ink">
          A product by <span className="text-primary">Guneet</span>
        </p>
        <p className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
          <Link to="/get-app" className="font-bold text-ink hover:text-primary">
            Get the app
          </Link>
          <a
            href="https://instagram.com/moijournal26"
            target="_blank"
            rel="noreferrer"
            className="font-bold text-ink hover:text-primary"
          >
            Support
          </a>
          <span>© 2026 MoiJournal</span>
        </p>
      </div>
    </footer>
  );
}
