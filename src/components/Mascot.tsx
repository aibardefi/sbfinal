import Image from "next/image";

/**
 * Capybara Blyatovich.
 *
 * One place that knows where the artwork lives and what its real aspect ratio
 * is, so no section has to hardcode either. The backdrop was cut out of the
 * upload, so this composites cleanly on any ground.
 */

/**
 * Where the artwork lives, base path and all.
 *
 * Nothing prefixes this for us. A string handed to a raw SVG `<image href>`
 * obviously goes through untouched, but `next/image` does not add the base path
 * either once `images.unoptimized` is set — with no optimizer URL to build, it
 * passes src straight through. So under a sub-path deployment every reference
 * to him, `<Image>` and `<image>` alike, asked for /assets/… at the domain root
 * and got a 404. Neither the build nor a local run at / shows this; it only
 * appears when the page is loaded from the path it will really be served from.
 *
 * Empty when the site is deployed at a domain root, so this stays correct for
 * both targets at once.
 */
export const MASCOT_SRC = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/assets/kapibara.webp`;
export const MASCOT_HREF = MASCOT_SRC;
export const MASCOT_W = 795;
export const MASCOT_H = 1008;

/**
 * His eyes, as fractions of the artwork. Measured from the file rather than
 * eyeballed — anything drawn over them (a tracking pupil, a sleeping eyelid)
 * has to sit inside a white sliver only ~3% of the image tall, and guessing
 * puts it outside the eye.
 */
export const EYES = {
  left: { cx: 0.3157, cy: 0.4812 },
  right: { cx: 0.6701, cy: 0.4811 },
  halfWidth: 0.0679,
  halfHeight: 0.0164,
};

export function Mascot({
  className,
  priority = false,
  alt = "Capybara Blyatovich",
  sizes = "(max-width: 640px) 60vw, 320px",
}: {
  className?: string;
  priority?: boolean;
  alt?: string;
  sizes?: string;
}) {
  return (
    <Image
      src={MASCOT_SRC}
      alt={alt}
      width={MASCOT_W}
      height={MASCOT_H}
      priority={priority}
      sizes={sizes}
      className={className}
      draggable={false}
      style={{ width: "100%", height: "auto", display: "block" }}
    />
  );
}
