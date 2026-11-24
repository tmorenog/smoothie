import type { IngredientId } from "@/lib/game/data";

/** Hand-drawn, shaded product illustrations for the market shelves. */
export function ProductArt({ id, size = 72 }: { id: IngredientId; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 100 100", "aria-hidden": true } as const;
  switch (id) {
    case "strawberry":
      return (
        <svg {...common}>
          <defs>
            <radialGradient id="sb" cx="40%" cy="35%" r="70%">
              <stop offset="0" stopColor="#ff7a8a" />
              <stop offset="0.6" stopColor="#e2344b" />
              <stop offset="1" stopColor="#a5182c" />
            </radialGradient>
          </defs>
          {[[30, 58], [62, 56]].map(([x, y], i) => (
            <g key={i} transform={`translate(${x - 50} ${y - 52}) rotate(${i ? 12 : -14} 50 52)`}>
              <path d="M50 88 C30 78 20 58 24 44 C28 32 40 30 50 34 C60 30 72 32 76 44 C80 58 70 78 50 88 Z" fill="url(#sb)" />
              {[...Array(14)].map((_, k) => (
                <ellipse key={k} cx={34 + (k % 5) * 8 + (Math.floor(k / 5) % 2) * 4} cy={46 + Math.floor(k / 5) * 11} rx="1.3" ry="2" fill="#ffe49a" opacity="0.9" />
              ))}
              <path d="M50 36 L38 26 L46 30 L42 18 L50 28 L58 18 L54 30 L62 26 Z" fill="#3f8f3a" />
              <ellipse cx="40" cy="44" rx="5" ry="3" fill="#fff" opacity="0.35" />
            </g>
          ))}
        </svg>
      );
    case "banana":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="bn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffe680" />
              <stop offset="1" stopColor="#e9b52c" />
            </linearGradient>
          </defs>
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`rotate(${-18 + i * 14} 50 50) translate(0 ${i * 5 - 6})`}>
              <path d="M14 40 C24 70 64 80 88 56 C90 54 88 50 85 52 C64 66 34 62 22 38 Z" fill="url(#bn)" stroke="#b98a1c" strokeWidth="1.2" />
              <path d="M14 40 L10 36 L16 34 L22 38 Z" fill="#6b4a22" />
              <circle cx="87" cy="54" r="2.4" fill="#4a3418" />
            </g>
          ))}
        </svg>
      );
    case "coffeeBeans":
      return (
        <svg {...common}>
          <path d="M24 26 L76 26 L80 90 L20 90 Z" fill="#c69c6d" />
          <path d="M24 26 L30 16 L70 16 L76 26 Z" fill="#a97f52" />
          <path d="M24 26 L76 26 L77 34 L23 34 Z" fill="#8e6a43" />
          <rect x="31" y="46" width="38" height="28" rx="4" fill="#f6efe5" />
          <text x="50" y="58" textAnchor="middle" fontSize="8" fontWeight="700" fill="#5a3622">CAFÉ</text>
          <text x="50" y="68" textAnchor="middle" fontSize="6" fill="#5a3622">beans</text>
          {[[34, 86], [46, 92], [60, 88], [70, 94]].map(([x, y], i) => (
            <g key={i} transform={`rotate(${i * 40} ${x} ${y})`}>
              <ellipse cx={x} cy={y} rx="6" ry="4.2" fill="#4a2c1a" />
              <path d={`M${x - 5} ${y} Q${x} ${y - 2} ${x + 5} ${y}`} stroke="#2a170c" strokeWidth="1" fill="none" />
            </g>
          ))}
        </svg>
      );
    case "egg":
      return (
        <svg {...common}>
          <path d="M8 60 L92 60 L86 84 L14 84 Z" fill="#b9a48a" />
          {[22, 40, 58, 76].map((x) => (
            <path key={x} d={`M${x - 8} 60 Q${x} 68 ${x + 8} 60`} fill="#a8937a" />
          ))}
          {[22, 40, 58, 76].map((x, i) => (
            <g key={x}>
              <ellipse cx={x} cy={52 - (i % 2) * 2} rx="8" ry="11" fill={i === 2 ? "#e9c9a0" : "#f6ecdc"} />
              <ellipse cx={x - 3} cy={47 - (i % 2) * 2} rx="2.5" ry="4" fill="#fff" opacity="0.6" />
            </g>
          ))}
        </svg>
      );
    case "flour":
      return (
        <svg {...common}>
          <path d="M26 26 C30 20 70 20 74 26 L80 86 C70 92 30 92 20 86 Z" fill="#efe7d8" stroke="#cdbfa8" strokeWidth="1.5" />
          <path d="M28 26 C36 30 64 30 72 26 L70 20 C60 16 40 16 30 20 Z" fill="#e2d6c1" />
          <path d="M44 16 L50 10 L56 16" stroke="#a5835a" strokeWidth="3" fill="none" />
          <rect x="30" y="46" width="40" height="22" rx="3" fill="#7f9f7a" />
          <text x="50" y="61" textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff">FLOUR</text>
          <path d="M22 84 C40 80 60 80 78 84" stroke="#fff" strokeWidth="2" opacity="0.7" />
        </svg>
      );
    case "wheat":
      return (
        <svg {...common}>
          {[-14, 0, 14].map((r) => (
            <g key={r} transform={`rotate(${r} 50 92)`}>
              <line x1="50" y1="92" x2="50" y2="22" stroke="#c9a14a" strokeWidth="2" />
              {[0, 1, 2, 3, 4, 5].map((k) => (
                <g key={k}>
                  <ellipse cx="45" cy={26 + k * 7} rx="3.2" ry="5.5" fill="#e0b85a" transform={`rotate(-25 45 ${26 + k * 7})`} />
                  <ellipse cx="55" cy={26 + k * 7} rx="3.2" ry="5.5" fill="#d6aa48" transform={`rotate(25 55 ${26 + k * 7})`} />
                </g>
              ))}
            </g>
          ))}
          <rect x="40" y="70" width="20" height="6" rx="2" fill="#e8728f" />
        </svg>
      );
    case "butter":
      return (
        <svg {...common}>
          <path d="M14 58 L50 44 L88 56 L52 72 Z" fill="#fff1a8" />
          <path d="M14 58 L52 72 L52 86 L14 72 Z" fill="#f2d66b" />
          <path d="M52 72 L88 56 L88 70 L52 86 Z" fill="#e6c454" />
          <path d="M30 64 L68 50 L88 56 L88 70 L52 86 L30 78 Z" fill="#f4f0e6" opacity="0.95" />
          <rect x="54" y="64" width="22" height="9" rx="2" fill="#6f8fc9" transform="rotate(-24 65 68)" />
          <text x="65" y="70.5" textAnchor="middle" fontSize="5.5" fontWeight="800" fill="#fff" transform="rotate(-24 65 68)">BUTTER</text>
        </svg>
      );
    case "donutDough":
      return (
        <svg {...common}>
          <ellipse cx="50" cy="74" rx="40" ry="12" fill="#a8adb3" />
          <ellipse cx="50" cy="71" rx="40" ry="12" fill="#c9ced4" />
          {[[32, 62], [66, 62]].map(([x, y], i) => (
            <g key={i}>
              <ellipse cx={x} cy={y} rx="15" ry="9" fill="#f3e2bd" />
              <ellipse cx={x} cy={y - 1} rx="5" ry="2.6" fill="#c9ced4" />
              <ellipse cx={x - 5} cy={y - 4} rx="4" ry="1.5" fill="#fff" opacity="0.5" />
            </g>
          ))}
        </svg>
      );
    case "sprinkles":
      return (
        <svg {...common}>
          <rect x="30" y="14" width="40" height="12" rx="3" fill="#e8728f" />
          <path d="M28 26 L72 26 L74 86 C74 90 70 92 66 92 L34 92 C30 92 26 90 26 86 Z" fill="#ffffff" opacity="0.55" stroke="#d9d2c6" strokeWidth="1.5" />
          {[...Array(40)].map((_, k) => {
            const colors = ["#f05d82", "#f2c84b", "#6f8fc9", "#7f9f7a", "#ffffff", "#a77bc9"];
            const x = 32 + ((k * 37) % 36);
            const y = 44 + ((k * 23) % 44);
            return <rect key={k} x={x} y={y} width="5" height="1.8" rx="0.9" fill={colors[k % colors.length]} transform={`rotate(${(k * 53) % 180} ${x} ${y})`} />;
          })}
          <rect x="34" y="34" width="32" height="8" rx="2" fill="#fbf6ee" />
          <text x="50" y="40.5" textAnchor="middle" fontSize="5.5" fontWeight="800" fill="#c94f6d">SPRINKLES</text>
        </svg>
      );
  }
}
