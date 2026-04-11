import { Link } from "react-router";

const DOWNLOADS = [
  { label: "Windows", sub: "x64", artifact: "jarvis-admin-windows-x64.exe" },
  { label: "macOS", sub: "Apple Silicon", artifact: "jarvis-admin-darwin-arm64" },
  { label: "Linux", sub: "x64", artifact: "jarvis-admin-linux-x64" },
  { label: "Linux", sub: "ARM64", artifact: "jarvis-admin-linux-arm64" },
];

const FEATURES = [
  {
    title: "Voice Controlled",
    description: "Natural voice commands for your home and daily tasks. Wake word detection, speech-to-text, and natural language understanding — all running locally.",
  },
  {
    title: "Fully Private",
    description: "No cloud dependencies, no data selling, no tracking. Your conversations never leave your network. 100% open source.",
  },
  {
    title: "Self-Hosted",
    description: "Run everything on your own hardware — from a laptop to a multi-GPU workstation. Your data, your rules.",
  },
  {
    title: "Extensible",
    description: "Add custom commands via the plugin interface, browse the community package store, or build your own with the AI-powered Forge.",
  },
];

const STEPS = [
  {
    step: "1",
    title: "Download & run",
    description: "Download the installer for your platform. It's a single file — just run it.",
  },
  {
    step: "2",
    title: "Configure",
    description: "The setup wizard detects your hardware, recommends a model, and lets you pick which services to enable.",
  },
  {
    step: "3",
    title: "Talk to Jarvis",
    description: "Connect a microphone, install the mobile app, or use the web chat. Jarvis is ready.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <header className="relative overflow-hidden">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-accent)] opacity-[0.07] blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-4xl px-6 pb-16 pt-20 text-center">
          <img
            src={`${import.meta.env.BASE_URL}jarvis_indigo500_transparent-logo.png`}
            alt="Jarvis"
            className="mx-auto mb-6 w-[24rem] drop-shadow-[0_0_60px_rgba(99,102,241,0.3)]"
          />
          <h1 className="sr-only">Jarvis</h1>
          <p className="mx-auto max-w-lg text-lg leading-relaxed text-[var(--color-text-secondary)]">
            Your personal voice assistant. Private, self-hosted, and open source.
          </p>

          {/* Download buttons */}
          <div className="mt-10">
            <div className="flex flex-wrap justify-center gap-3">
              {DOWNLOADS.map((dl) => (
                <a
                  key={dl.artifact}
                  href={`https://github.com/alexberardi/jarvis-admin/releases/latest/download/${dl.artifact}`}
                  className="group flex min-w-[140px] flex-col items-center gap-0.5 rounded-xl bg-[var(--color-accent)] px-6 py-3.5 text-white transition-all hover:bg-[var(--color-accent-hover)] hover:shadow-[0_0_30px_rgba(99,102,241,0.3)]"
                >
                  <span className="text-sm font-semibold">{dl.label}</span>
                  <span className="text-xs opacity-70">{dl.sub}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Terminal command */}
          <div className="mx-auto mt-8 max-w-lg">
            <p className="mb-2 text-xs text-[var(--color-text-secondary)]">
              or install from your terminal
            </p>
            <div className="group relative rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-left font-mono text-sm text-[var(--color-text-secondary)]">
              <span className="select-none text-[var(--color-accent)]">$ </span>
              <span className="text-[var(--color-text)]">
                curl -fsSL https://raw.githubusercontent.com/alexberardi/jarvis-admin/main/install.sh | sh
              </span>
            </div>
          </div>

          {/* Docker Compose alternative */}
          <div className="mt-6 flex flex-col items-center gap-2">
            <p className="text-xs text-[var(--color-text-secondary)]">
              NAS or Docker UI?
            </p>
            <Link
              to="/configurator"
              className="rounded-lg border border-[var(--color-border)] px-5 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text)]"
            >
              Generate a Docker Compose file
            </Link>
          </div>
        </div>
      </header>

      {/* How it works */}
      <section className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <h2 className="mb-12 text-center text-2xl font-bold">Up and running in minutes</h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.step} className="text-center">
                <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-lg font-bold text-[var(--color-accent)]">
                  {s.step}
                </div>
                <h3 className="mb-2 text-sm font-semibold">{s.title}</h3>
                <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  {s.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-[var(--color-border)]">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <h2 className="mb-12 text-center text-2xl font-bold">Why Jarvis?</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 transition-colors hover:border-[var(--color-accent)]/30"
              >
                <h3 className="text-base font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compatibility */}
      <section className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Works with TrueNAS, Portainer, Synology, Unraid, or any Docker environment.
            <br />
            Runs on x86 and ARM. GPU optional.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] py-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 text-sm text-[var(--color-text-secondary)]">
          <span>Jarvis is open source software.</span>
          <a
            href="https://github.com/alexberardi/jarvis"
            className="transition-colors hover:text-[var(--color-text)]"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
