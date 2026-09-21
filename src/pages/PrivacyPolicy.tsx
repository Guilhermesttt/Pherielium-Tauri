import { PHERIELIUM_LOGO_PATH } from "../constants/assets";

const updatedAt = "July 3, 2026";

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-[#050507] text-white">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-16 sm:px-8 lg:px-10">
        <div className="flex items-center gap-3">
          <img src={PHERIELIUM_LOGO_PATH} alt="Pherielium" className="h-10 w-10 object-contain" />
          <span className="text-lg font-heading font-bold tracking-[0.18em] text-white/90">
            PHERIELIUM
          </span>
        </div>

        <header className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-300">
            Privacy Policy
          </p>
          <h1 className="text-4xl font-heading font-bold tracking-tight sm:text-5xl">
            Pherielium Privacy Policy
          </h1>
          <p className="max-w-2xl text-base leading-7 text-white/65 font-body">
            Last updated: {updatedAt}. This policy explains how Pherielium
            handles information when you use our platform, game hub, and account
            linking features.
          </p>
        </header>

        <div className="space-y-8 text-sm leading-7 text-white/70">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white">Who We Are</h2>
            <p>
              Phelierium is a game library and launcher experience. For privacy questions, contact us at{" "}
              <a className="text-sky-300 underline-offset-4 hover:underline" href="mailto:dev.guilhermesantana@gmail.com">
                dev.guilhermesantana@gmail.com
              </a>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white">Information We Collect</h2>
            <p>
              We may collect account information you provide or authorize, such
              as your name, email address, profile image, user ID, and linked
              account identifiers from supported services. We may also store
              launcher preferences, game library entries, connection status, and
              basic technical information needed to operate and secure the
              service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white">How We Use Information</h2>
            <p>
              We use information to provide login, synchronize your game
              library, connect supported third-party accounts, save your
              preferences, improve reliability, prevent abuse, and respond to
              support requests.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white">Third-Party Services</h2>
            <p>
              Phelierium may use third-party services such as Supabase, Epic
              Games, Steam, Discord, hosting providers, and analytics or
              infrastructure providers. These services process information under
              their own privacy policies when you use or authorize their
              features.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white">Data Sharing</h2>
            <p>
              We do not sell personal information. We share information only
              when necessary to operate the service, comply with legal
              obligations, protect the service, or when you authorize a
              third-party account connection.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white">Data Retention</h2>
            <p>
              We keep information for as long as needed to provide Phelierium,
              maintain security, resolve disputes, and comply with legal
              obligations. You may request deletion of your account data by
              contacting us.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white">Your Choices</h2>
            <p>
              You can disconnect third-party accounts where supported, stop
              using the service, or contact us to request access, correction, or
              deletion of your personal information.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white">Children</h2>
            <p>
              Phelierium is not directed to children under 13. We do not
              knowingly collect personal information from children under 13.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white">Changes to This Policy</h2>
            <p>
              We may update this policy from time to time. When we do, we will
              update the date shown at the top of this page.
            </p>
          </section>
        </div>

        <a className="inline-flex w-fit rounded-md border border-white/15 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10" href="/">
          Back to Phelierium
        </a>
      </section>
    </main>
  );
}
