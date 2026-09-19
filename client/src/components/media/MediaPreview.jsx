import { useState } from "react";
import clsx from "clsx";

const VIDEO_EXT = /\.(mp4|mov|webm|m4v)(\?|$)/i;

/**
 * Renders an avatar's preview, which is not always an image.
 *
 * A video-cloned avatar's preview may be a still (Tavus returns a thumbnail)
 * or the training clip itself (the mock provider hands back what it was given),
 * so the source type is not a reliable signal - the URL is. Anything that
 * fails to load falls back to a label rather than a broken-image icon.
 */
export default function MediaPreview({ src, alt = "", className, fallback = "No preview" }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={clsx("flex items-center justify-center bg-surface-3", className)}>
        <span className="text-ui text-text-faint">{fallback}</span>
      </div>
    );
  }

  if (VIDEO_EXT.test(src)) {
    return (
      <video
        src={src}
        muted
        loop
        autoPlay
        playsInline
        onError={() => setFailed(true)}
        className={clsx("object-cover", className)}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className={clsx("object-cover", className)}
    />
  );
}
