import { cn } from "@/lib/utils";

/*
 * Gobi brand mark, drawn from the brand files in public/brand/. The letter
 * counters (and the arrow in the "o" on light backgrounds) are cut out with
 * even-odd fills rather than painted white or black, so the mark sits cleanly
 * on glass, photos and the navy sidebar. Shapes and colours match the files.
 */
const BRAND_ORANGE = "#F36A46";

const G_BOWL =
  "M17.378 47.3579C26.694 47.3579 34.2462 39.455 34.2462 29.7063C34.2462 19.9577 26.694 12.0548 17.378 12.0548C8.06192 12.0548 0.509766 19.9577 0.509766 29.7063C0.509766 39.455 8.06192 47.3579 17.378 47.3579Z" +
  "M17.7573 38.8415C22.5007 38.8415 26.3461 34.6779 26.3461 29.5419C26.3461 24.4058 22.5007 20.2422 17.7573 20.2422C13.0138 20.2422 9.16846 24.4058 9.16846 29.5419C9.16846 34.6779 13.0138 38.8415 17.7573 38.8415Z";
const G_STEM =
  "M29.2534 17.173L32.6097 13.4097H34.8873V44.2999C34.8873 49.2814 31.8431 54.1041 29.691 55.9022C24.4948 60.2426 13.5337 59.462 13.5337 59.462V50.8509C13.6926 50.5359 19.2651 52.0691 22.6438 49.9979C24.5115 48.8521 25.5263 46.5802 26.7723 41.5986C28.0184 36.617 30.0618 29.0011 29.2534 17.1786V17.173Z";
const O_RING =
  "M55.7348 47.6199C65.2479 47.6199 72.9598 39.6584 72.9598 29.8374C72.9598 20.0163 65.2479 12.0548 55.7348 12.0548C46.2217 12.0548 38.5098 20.0163 38.5098 29.8374C38.5098 39.6584 46.2217 47.6199 55.7348 47.6199Z";
const O_ARROW =
  "M41.6428 28.3487L64.2731 19.0379C64.2731 19.0379 67.2476 18.5278 66.6008 21.6834C66.3165 23.0661 64.3428 27.3284 62.3942 31.8528C59.8993 37.6484 57.343 43.7785 57.343 43.7785C57.343 43.7785 54.5581 46.8394 53.4904 41.802C53.1866 40.3636 53.2869 40.2298 53.1057 39.1064C52.6485 36.2908 52.1941 33.4139 52.1941 33.4139L42.0554 31.8027C42.0554 31.8027 40.8372 31.1949 40.8567 29.9712C40.865 29.5084 40.9849 28.9648 41.6428 28.3459V28.3487Z";
const O_ARROW_TIP =
  "M61.5692 24.2593L56.5319 36.1264L55.6928 31.6968C55.6928 31.6968 55.6844 30.2277 52.9971 29.7984C52.1469 29.6618 49.2979 29.2297 49.2979 29.2297L61.1789 24.3541Z";
const B_BOWL =
  "M85.4387 0.804667H76.8276V30.6384C76.8276 30.6384 77.0004 36.2527 79.1859 39.7708C81.4272 43.3808 85.7732 47.5958 93.1243 48.0641C107.645 48.9896 111.345 35.5586 111.133 30.6356C110.918 25.7153 108.788 15.1528 97.4675 13.115C87.5741 11.3365 85.5195 16.9369 85.5112 16.2456L85.4387 0.80188V0.804667Z" +
  "M93.6958 39.6676C98.5702 39.6676 102.522 35.5564 102.522 30.485C102.522 25.4136 98.5702 21.3024 93.6958 21.3024C88.8215 21.3024 84.8701 25.4136 84.8701 30.485C84.8701 35.5564 88.8215 39.6676 93.6958 39.6676Z";
const I_STEM = "M125.271 14.7998H116.588V48.1097H125.271V14.7998Z";
const I_DOT =
  "M121.07 11.5242C124.345 11.5242 127 8.94446 127 5.76212C127 2.57979 124.345 0 121.07 0C117.796 0 115.141 2.57979 115.141 5.76212C115.141 8.94446 117.796 11.5242 121.07 11.5242Z";

/** The "go" glyphs shared by the wordmark and the compact mark (as in the favicon). */
function GoGlyphs({ inverse }: { inverse?: boolean }) {
  return (
    <>
      <path fillRule="evenodd" d={G_BOWL} />
      <path d={G_STEM} />
      {inverse ? (
        // The white logo fills the arrow orange instead of cutting it out.
        <>
          <path d={O_RING} />
          <path d={O_ARROW} fill={BRAND_ORANGE} />
        </>
      ) : (
        <>
          <path fillRule="evenodd" d={O_RING + O_ARROW} />
          <path d={O_ARROW_TIP} fill={BRAND_ORANGE} />
        </>
      )}
    </>
  );
}

/** Full "gobi" wordmark. `inverse` is the white version for dark surfaces and photos. */
export function Wordmark({ className, inverse }: { className?: string; inverse?: boolean }) {
  return (
    <svg
      viewBox="0 0 127 60"
      role="img"
      aria-label="Gobi"
      fill="currentColor"
      className={cn("h-9 w-auto shrink-0", inverse ? "text-white" : "text-black", className)}
    >
      <GoGlyphs inverse={inverse} />
      <path fillRule="evenodd" d={B_BOWL} />
      <path d={I_STEM} />
      <path d={I_DOT} fill={BRAND_ORANGE} />
    </svg>
  );
}

/** Compact "go" mark for tight spaces such as the collapsed sidebar. */
export function LogoMark({ className, inverse }: { className?: string; inverse?: boolean }) {
  return (
    <svg
      viewBox="0 0 73.5 60"
      role="img"
      aria-label="Gobi"
      fill="currentColor"
      className={cn("h-8 w-auto shrink-0", inverse ? "text-white" : "text-black", className)}
    >
      <GoGlyphs inverse={inverse} />
    </svg>
  );
}

/** Wordmark with an optional tagline set beside it. */
export function Logo({
  className,
  tagline,
  inverse,
}: {
  className?: string;
  tagline?: string;
  inverse?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <Wordmark inverse={inverse} />
      {tagline && (
        <span
          className={cn(
            "max-w-[6.5rem] border-l pl-3 text-caption leading-tight",
            inverse ? "border-white/20 text-white/70" : "border-line text-ink-muted",
          )}
        >
          {tagline}
        </span>
      )}
    </span>
  );
}
