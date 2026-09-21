import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { avatarApi } from "@/services/avatar.api";
import { studioApi } from "@/services/studio.api";
import { healthApi } from "@/services/health.api";
import MediaPreview from "@/components/media/MediaPreview";
import Button from "@/components/common/Button";

/**
 * Hero-led landing page.
 *
 * The point of the product is talking to an avatar, so the page leads with one
 * you can talk to right now rather than with a menu of things you could
 * configure. The workspace's own avatar is preferred; a ready-made one stands
 * in when there is none, because a new workspace would otherwise land on an
 * empty page.
 */

export default function Home() {
  const { data: avatars } = useQuery({ queryKey: ["avatars"], queryFn: avatarApi.list });
  const { data: stock } = useQuery({
    queryKey: ["stock-avatars"],
    queryFn: studioApi.stock,
    staleTime: 10 * 60 * 1000,
  });
  const { data: health } = useQuery({ queryKey: ["health"], queryFn: healthApi.get });

  const mine = avatars?.find((a) => a.callable);
  const featured = mine
    ? { name: mine.name, previewUrl: mine.previewUrl, to: `/call/${mine._id}`, owned: true }
    : stock?.[0]
      ? { name: stock[0].name, previewUrl: stock[0].previewUrl, to: "/studio", owned: false }
      : null;

  return (
    <>
      {/* Static. An earlier version cycled the accent phrase as a typewriter;
          it fought the layout - the changing length collapsed the space before
          "with" - and a headline is not the place for the only motion on the
          page. */}
      <h1 className="max-w-4xl text-balance">
        Build <span className="text-pink">a conversational agent</span>
        {featured ? ` with ${featured.name}` : " in minutes"}
      </h1>
      <p className="mt-3 max-w-2xl text-text-muted">
        No need to start from scratch. Pick a face, give it a brief, and talk to it in the browser.
      </p>

      {featured && <Hero {...featured} />}

      <Section
        label="Go live in minutes"
        title="Three ways to get a face"
        className="mt-12"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Step
            n="1"
            title="Ready-made"
            body="Pick one the provider already trained. Nothing to upload."
          />
          <Step n="2" title="Photo" body="One still image becomes an avatar. No training step." />
          <Step n="3" title="Video clone" body="A short clip trains a likeness of a real person." />
        </div>
        <div className="mt-4">
          <Button as={Link} to="/studio">
            Create an avatar
          </Button>
        </div>
      </Section>

      {avatars?.length > 0 && (
        <Section label="Your workspace" title="Avatars" className="mt-12">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {avatars.slice(0, 8).map((a) => (
              <Link
                key={a._id}
                to={a.callable ? `/call/${a._id}` : "/avatars"}
                className="group relative overflow-hidden rounded-lg border border-border transition-colors hover:border-border-strong"
              >
                <MediaPreview src={a.previewUrl} className="aspect-[3/4] w-full" />
                <span className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-3 text-ui font-medium">
                  {a.name}
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {health && (
        <p className="mt-12 text-ui text-text-faint">
          {health.avatarProvider || "automatic"} · livekit {health.livekit.mode} · storage{" "}
          {health.storage?.driver}
        </p>
      )}
    </>
  );
}

/**
 * The avatar, large, with its invitation sitting on the image.
 *
 * Deliberately not a Card: a card's padding and border would frame the subject
 * and shrink it, and this is the one thing on the page that should dominate.
 */
function Hero({ name, previewUrl, to, owned }) {
  return (
    <div className="relative mt-8 overflow-hidden rounded-xl border border-border bg-surface-2">
      <MediaPreview src={previewUrl} className="aspect-video w-full" />

      {/* Name badge, top left. */}
      <span className="absolute left-5 top-5 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-ui font-medium backdrop-blur">
        <span aria-hidden className="h-2 w-2 rounded-full bg-green" />
        {name}
      </span>

      {/* Invitation, bottom left, over a gradient so it stays readable. */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-6 pt-20">
        <p className="text-h3 font-medium">Hey, I&apos;m {name}</p>
        <p className="mt-1 text-ui text-text-muted">
          {owned ? "Ready when you are." : "Add me to your workspace and we can talk."}
        </p>
        <div className="mt-4 flex items-center gap-4">
          <Button as={Link} to={to}>
            {owned ? `Talk to ${name.split(" ")[0]}` : "Use this avatar"}
          </Button>
          <Link to="/studio" className="text-ui text-text-muted hover:text-text">
            or pick another
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({ label, title, className, children }) {
  return (
    <section className={className}>
      <p className="font-mono text-label uppercase tracking-wide text-pink">{label}</p>
      <h2 className="mt-1.5">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Step({ n, title, body }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-3 font-mono text-label">
        {n}
      </span>
      <h3 className="mt-4">{title}</h3>
      <p className="mt-1 text-ui text-text-muted">{body}</p>
    </div>
  );
}
