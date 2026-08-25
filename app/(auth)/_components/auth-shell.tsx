export type HeroFeature = {
  icon: React.ReactNode;
  title: string;
  body: string;
};

export type HeroContent = {
  eyebrow: string;
  heading: string;
  body: string;
  /** Shorter one-liner shown in the condensed mobile banner instead of `body` */
  mobileBody?: string;
  features?: HeroFeature[];
};

function HeroOverlay() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(48rem_30rem_at_85%_-10%,rgba(63,183,130,0.22),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] bg-[linear-gradient(#ffffff12_1px,transparent_1px),linear-gradient(90deg,#ffffff12_1px,transparent_1px)] bg-[size:56px_56px]"
      />
    </>
  );
}

export function AuthShell({
  hero,
  children,
}: {
  hero: HeroContent;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex w-full max-w-[1280px] flex-col overflow-hidden rounded-[10px] border border-border-card bg-surface desktop:grid desktop:grid-cols-2">
      <div className="relative order-1 flex flex-col justify-center overflow-hidden bg-hero-bg px-6 py-8 tablet:px-10 tablet:py-10 desktop:order-2 desktop:px-16 desktop:py-14">
        <HeroOverlay />

        {/* Mobile: condensed one-line banner, no heading */}
        <p className="relative text-sm leading-6 text-hero-text-muted tablet:hidden">
          {hero.mobileBody ?? hero.body}
        </p>

        {/* Tablet and up: full eyebrow + heading + body */}
        <div className="relative hidden tablet:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 font-mono text-[11px] tracking-[0.06em] text-success-text">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {hero.eyebrow}
          </div>
          <h2 className="mt-5 max-w-[420px] text-[26px] font-semibold leading-8 tracking-[-0.03em] text-hero-text text-pretty desktop:mt-6 desktop:text-[34px] desktop:leading-[42px]">
            {hero.heading}
          </h2>
          <p className="mt-4 max-w-[400px] text-[15px] leading-[26px] text-hero-text-muted">
            {hero.body}
          </p>
        </div>

        {hero.features ? (
          <div className="relative mt-8 hidden flex-col gap-3 desktop:flex">
            {hero.features.map((feature) => (
              <div
                key={feature.title}
                className="flex items-start gap-3 rounded-[10px] border border-hero-border bg-hero-card px-5 py-4"
              >
                <span className="mt-0.5 text-accent">{feature.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-hero-text">
                    {feature.title}
                  </p>
                  <p className="mt-[3px] text-[13px] leading-5 text-hero-text-subtle">
                    {feature.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="order-2 flex flex-col justify-center px-6 py-8 tablet:px-10 tablet:py-10 desktop:order-1 desktop:px-[72px] desktop:py-12">
        {children}
      </div>
    </div>
  );
}
