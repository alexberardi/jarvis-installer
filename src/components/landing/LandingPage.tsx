import { Link } from "react-router";

const DOWNLOADS = [
  { label: "Windows x64", artifact: "jarvis-admin-windows-x64.exe" },
  { label: "macOS (Apple Silicon)", artifact: "jarvis-admin-darwin-arm64" },
  { label: "Linux x64", artifact: "jarvis-admin-linux-x64" },
  { label: "Linux ARM64", artifact: "jarvis-admin-linux-arm64" },
];

const FEATURES = [
  {
    title: "Voice Controlled",
    description: "Natural voice commands for your home and daily tasks",
  },
  {
    title: "Fully Private",
    description: "All data stays local. No cloud dependencies, no data selling. 100% open source.",
  },
  {
    title: "Self-Hosted",
    description: "Run everything on your own hardware. Your data, your rules.",
  },
  {
    title: "Extensible",
    description: "Add custom commands and integrations via the plugin interface",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <header className="mx-auto max-w-4xl px-6 py-24 text-center">
        <img
          src={`${import.meta.env.BASE_URL}jarvis_indigo500_transparent-logo.png`}
          alt="Jarvis"
          className="mx-auto mb-8 w-[30rem]"
        />
        <h1 className="sr-only">Jarvis</h1>
        <p className="text-xl text-[var(--color-text-secondary)]">
          Your personal voice assistant. Private, self-hosted, and open source.
        </p>
        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="flex gap-4">
            <Link
              to="/configurator"
              className="rounded-lg bg-[var(--color-accent)] px-8 py-3 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)]"
            >
              Get Started
            </Link>
            <a
              href="https://github.com/alexberardi/jarvis"
              className="rounded-lg border border-[var(--color-border)] px-8 py-3 text-sm font-medium hover:bg-[var(--color-bg-tertiary)]"
            >
              GitHub
            </a>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Works with TrueNAS, Portainer, Synology, Unraid, or any Docker environment
          </p>
        </div>

        {/* Direct download */}
        <div className="mt-6">
          <p className="mb-3 text-sm text-[var(--color-text-secondary)]">
            Or download the installer directly:
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {DOWNLOADS.map((dl) => (
              <a
                key={dl.artifact}
                href={`https://github.com/alexberardi/jarvis-admin/releases/latest/download/${dl.artifact}`}
                className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-xs font-medium hover:bg-[var(--color-bg-tertiary)]"
              >
                {dl.label}
              </a>
            ))}
          </div>
        </div>
      </header>

      {/* Features */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="grid gap-6 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6"
            >
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] py-8 text-center text-sm text-[var(--color-text-secondary)]">
        Jarvis is open source software. No cloud required.
      </footer>
    </div>
  );
}
