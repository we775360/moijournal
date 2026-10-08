import { createFileRoute, Link } from "@tanstack/react-router";
import { btnPrimary, btnSoft, Card, Logo } from "@/components/mj";
import { absoluteUrl } from "@/lib/site";

// Drop a hosted .apk URL here and the Android card switches from "coming soon" to a download
// button. An APK must be served over HTTPS from a host that allows direct downloads.
const ANDROID_APK_URL = "";

export const Route = createFileRoute("/get-app")({
  head: () => ({
    meta: [
      { title: "Get the MoiJournal app — Android, iPhone and desktop" },
      {
        name: "description",
        content:
          "Install MoiJournal as an app on Android, iPhone, iPad or desktop. Same cosy diary, same encryption, no app store needed.",
      },
      { property: "og:title", content: "Get the MoiJournal app" },
      {
        property: "og:description",
        content: "Install MoiJournal as an app on Android, iPhone, iPad or desktop.",
      },
      { property: "og:url", content: absoluteUrl("/get-app") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/get-app") }],
  }),
  component: GetApp,
});

const STEPS: { who: string; emoji: string; steps: string[] }[] = [
  {
    who: "Android",
    emoji: "🤖",
    steps: [
      "Open MoiJournal in Chrome.",
      "Tap the ⋮ menu at the top right.",
      "Tap “Add to Home screen”, then “Install”.",
    ],
  },
  {
    who: "iPhone & iPad",
    emoji: "🍎",
    steps: [
      "Open MoiJournal in Safari.",
      "Tap the Share button at the bottom.",
      "Tap “Add to Home Screen”, then “Add”.",
    ],
  },
  {
    who: "Desktop",
    emoji: "💻",
    steps: [
      "Open MoiJournal in Chrome or Edge.",
      "Look for the install icon in the address bar.",
      "Click it — MoiJournal opens in its own window.",
    ],
  },
];

function GetApp() {
  return (
    <div className="min-h-screen px-5 py-6">
      <div className="mx-auto flex max-w-3xl items-center justify-between">
        <Logo />
        <Link to="/" className="text-sm font-bold text-ink hover:text-primary">
          ← back home
        </Link>
      </div>

      <div className="mx-auto mt-12 max-w-3xl">
        <p className="font-hand text-3xl text-primary">take it with you</p>
        <h1 className="mt-1 text-4xl font-extrabold text-ink md:text-5xl">
          Get MoiJournal on your phone
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          MoiJournal installs straight from the web — no app store, no update nag. It looks and
          feels the same in every browser, and your diary stays encrypted either way.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {STEPS.map(({ who, emoji, steps }) => (
            <div key={who} className="sticker reveal rounded-2xl bg-paper p-6">
              <h2 className="text-xl font-bold text-ink">
                {emoji} {who}
              </h2>
              <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
                {steps.map((s, i) => (
                  <li key={s}>
                    <b className="text-ink">{i + 1}.</b> {s}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        <Card className="mt-8 bg-butter">
          <h2 className="text-xl font-bold text-ink">📦 Android APK</h2>
          {ANDROID_APK_URL ? (
            <>
              <p className="mt-1 text-ink/80">
                Prefer a plain APK? Download it and tap to install — you may need to allow installs
                from your browser.
              </p>
              <a className={`${btnPrimary} mt-4`} href={ANDROID_APK_URL} download>
                Download the APK
              </a>
            </>
          ) : (
            <p className="mt-1 text-ink/80">
              We're packaging MoiJournal as a downloadable APK for Android. Until it lands, the
              install steps above give you the exact same diary as a real app icon.
            </p>
          )}
        </Card>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/signup" className={btnPrimary}>
            Start my diary — free
          </Link>
          <Link to="/login" className={btnSoft}>
            I have a diary
          </Link>
        </div>
      </div>
    </div>
  );
}
