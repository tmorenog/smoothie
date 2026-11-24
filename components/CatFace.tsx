import type { CoatSpec } from "@/lib/game/data";

/** Small SVG cat portrait used in the order card and the 2D fallback. */
export function CatFace({ coat, size = 56, happy = false }: { coat: CoatSpec; size?: number; happy?: boolean }) {
  const stripes = coat.pattern === "tabby" || coat.pattern === "bandit";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <path d="M18 40 L24 8 L44 28 Z" fill={coat.pattern === "point" ? coat.markings : coat.base} />
      <path d="M82 40 L76 8 L56 28 Z" fill={coat.pattern === "point" ? coat.markings : coat.base} />
      <path d="M24 34 L27 16 L38 28 Z" fill={coat.earInner} />
      <path d="M76 34 L73 16 L62 28 Z" fill={coat.earInner} />
      <ellipse cx="50" cy="56" rx="38" ry="34" fill={coat.base} />
      {coat.pattern === "calico" && (
        <>
          <ellipse cx="30" cy="40" rx="16" ry="12" fill={coat.patches[0]} />
          <ellipse cx="72" cy="46" rx="12" ry="14" fill={coat.patches[1]} />
        </>
      )}
      {stripes && (
        <g stroke={coat.markings} strokeWidth="4" strokeLinecap="round" opacity="0.8">
          <path d="M50 24 L50 36" />
          <path d="M40 26 L43 37" />
          <path d="M60 26 L57 37" />
          <path d="M14 54 L24 56" />
          <path d="M86 54 L76 56" />
        </g>
      )}
      {coat.pattern === "tuxedo" && <path d="M50 34 C42 50 30 62 34 80 L66 80 C70 62 58 50 50 34 Z" fill={coat.muzzle} />}
      {coat.pattern === "bandit" && <rect x="18" y="44" width="64" height="14" rx="7" fill={coat.markings} />}
      <ellipse cx="50" cy="70" rx="16" ry="11" fill={coat.muzzle} />
      {happy ? (
        <g stroke="#1b1b1b" strokeWidth="3.5" fill="none" strokeLinecap="round">
          <path d="M28 52 Q35 44 42 52" />
          <path d="M58 52 Q65 44 72 52" />
        </g>
      ) : (
        <>
          <ellipse cx="35" cy="51" rx="7.5" ry="8" fill={coat.eyes} />
          <ellipse cx="65" cy="51" rx="7.5" ry="8" fill={coat.eyes} />
          <ellipse cx="35" cy="51" rx="2.4" ry="6.5" fill="#111" />
          <ellipse cx="65" cy="51" rx="2.4" ry="6.5" fill="#111" />
          <circle cx="37" cy="48" r="1.6" fill="#fff" />
          <circle cx="67" cy="48" r="1.6" fill="#fff" />
        </>
      )}
      <path d="M46 63 L54 63 L50 68 Z" fill={coat.nose} />
      <path d="M50 68 Q46 74 42 72 M50 68 Q54 74 58 72" stroke="#3a2a2a" strokeWidth="1.6" fill="none" />
      <g stroke={coat.base === "#19181b" || coat.base === "#1f1c21" ? "#e9e4da" : "#6b6058"} strokeWidth="1" opacity="0.8">
        <path d="M36 68 L8 62" />
        <path d="M36 71 L8 72" />
        <path d="M36 74 L10 82" />
        <path d="M64 68 L92 62" />
        <path d="M64 71 L92 72" />
        <path d="M64 74 L90 82" />
      </g>
    </svg>
  );
}

export function AvatarFace({ gender, skin, hair, apron, size = 40 }: { gender: "girl" | "boy"; skin: string; hair: string; apron: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="48" fill="#fbf6ee" />
      {gender === "girl" && <ellipse cx="50" cy="56" rx="30" ry="34" fill={hair} />}
      <path d="M22 100 C22 78 34 70 50 70 C66 70 78 78 78 100 Z" fill="#f6efe3" />
      <path d="M34 100 L36 78 L64 78 L66 100 Z" fill={apron} />
      <circle cx="50" cy="46" r="22" fill={skin} />
      <path d="M28 44 C28 24 72 24 72 44 C66 34 40 32 28 44 Z" fill={hair} />
      {gender === "girl" && <circle cx="50" cy="22" r="8" fill={hair} />}
      {gender === "girl" && <ellipse cx="64" cy="28" rx="6" ry="3.5" fill={apron} />}
      <circle cx="42" cy="47" r="2.6" fill="#2b2220" />
      <circle cx="58" cy="47" r="2.6" fill="#2b2220" />
      <path d="M43 56 Q50 61 57 56" stroke="#2b2220" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <circle cx="37" cy="54" r="3" fill="#f2a1a8" opacity="0.7" />
      <circle cx="63" cy="54" r="3" fill="#f2a1a8" opacity="0.7" />
    </svg>
  );
}
