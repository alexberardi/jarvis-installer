import { Link } from "react-router";

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
        <h1 className="text-5xl font-bold tracking-tight">
          <span className="text-[var(--color-accent)]">Jarvis</span>
        </h1>
        <p className="mt-4 text-xl text-[var(--color-text-secondary)]">
          Your personal voice assistant. Private, self-hosted, and open source.
        </p>
        <div className="mt-8 flex justify-center gap-4">
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
