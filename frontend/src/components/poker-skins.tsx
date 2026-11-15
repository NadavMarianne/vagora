// How a poker table looks: its skin. Three kinds: plain colors, artistic painted felts, and
// special ones (little card suits, a starry night, a royal pattern...). `Felt` draws any of them, at
// any size: the table itself and the small previews to pick from. Patterns come from a random
// generator seeded by the skin's name, so a table looks the same on every phone. All the felts are
// mid to dark, so the white text and card outlines on them stay easy to read.
import { memo, useMemo } from "react";
import { View } from "react-native";
import Svg, {
    Circle,
    Defs,
    Ellipse,
    G,
    Line,
    Path,
    RadialGradient,
    Rect,
    Stop,
    Text as SvgText,
} from "react-native-svg";

export const DEFAULT_SKIN = "green";

const WOOD = "#5A3A1F";
const GOLD = "#C9A227";

type Paint =
    | { kind: "plain" }
    | { kind: "blobs"; colors: string[]; opacity: number }
    | { kind: "strokes"; colors: string[]; opacity: number }
    | { kind: "suits" }
    | { kind: "stars" }
    | { kind: "lattice" }
    | { kind: "chips" }
    | { kind: "ring" };

type Skin = {
    id: string;
    name: string;
    felt: string;
    rim: string;
    paint: Paint;
    /** For the numbers on the felt (the pot, the timer) and the hourglass's sand: a color that
     * stands out on this felt. */
    accent: string;
    /** The same, for the last few seconds of a turn: a warning that still shows on this felt. */
    late: string;
};

const GOLDEN = "#E8C547";
const WARN = "#FF6B5B";
// On red and orange felts a red warning would vanish: a pale pink one shows.
const PALE_WARN = "#FFC2B8";

/** Every skin, in the sections the picker shows. The names match the backend's list. */
export const SKIN_SECTIONS: { title: string; skins: Skin[] }[] = [
    {
        title: "Colors",
        skins: [
            {
                id: "green",
                name: "Green",
                felt: "#0E6B3C",
                rim: WOOD,
                paint: { kind: "plain" },
                accent: GOLDEN,
                late: WARN,
            },
            {
                id: "blue",
                name: "Blue",
                felt: "#14507F",
                rim: WOOD,
                paint: { kind: "plain" },
                accent: GOLDEN,
                late: WARN,
            },
            {
                id: "red",
                name: "Red",
                felt: "#7E1F2B",
                rim: WOOD,
                paint: { kind: "plain" },
                accent: "#F7D774",
                late: PALE_WARN,
            },
            {
                id: "orange",
                name: "Orange",
                felt: "#A84E17",
                rim: WOOD,
                paint: { kind: "plain" },
                accent: "#FFF0C2",
                late: PALE_WARN,
            },
            {
                id: "purple",
                name: "Purple",
                felt: "#4B2A7B",
                rim: WOOD,
                paint: { kind: "plain" },
                accent: GOLDEN,
                late: WARN,
            },
            {
                id: "black",
                name: "Black",
                felt: "#1E2126",
                rim: "#3A2A1C",
                paint: { kind: "plain" },
                accent: GOLDEN,
                late: WARN,
            },
        ],
    },
    {
        title: "Artistic",
        skins: [
            {
                id: "watercolor",
                name: "Watercolor",
                felt: "#1F4E5A",
                rim: WOOD,
                paint: {
                    kind: "blobs",
                    colors: [
                        "#F28FAD",
                        "#F7D774",
                        "#7FD6C2",
                        "#A58BEA",
                        "#F39C6B",
                    ],
                    opacity: 0.22,
                },
                accent: "#FFE08A",
                late: WARN,
            },
            {
                id: "ink",
                name: "Ink",
                felt: "#26272B",
                rim: "#1A1A1C",
                paint: {
                    kind: "strokes",
                    colors: ["#FFFFFF", "#B9B9BE", "#6E6E76"],
                    opacity: 0.14,
                },
                accent: "#E8E8EC",
                late: WARN,
            },
            {
                id: "sunset",
                name: "Sunset",
                felt: "#5A2340",
                rim: WOOD,
                paint: {
                    kind: "strokes",
                    colors: ["#F2994A", "#EB5757", "#F2C94C", "#BB6BD9"],
                    opacity: 0.35,
                },
                accent: "#FFE7A3",
                late: PALE_WARN,
            },
            {
                id: "ocean",
                name: "Ocean",
                felt: "#0B3C5D",
                rim: "#3B2A1C",
                paint: {
                    kind: "strokes",
                    colors: ["#2EC4B6", "#5FA8D3", "#CBF3F0", "#1B98E0"],
                    opacity: 0.3,
                },
                accent: "#8FF0E4",
                late: WARN,
            },
            {
                id: "pastel",
                name: "Pastel",
                felt: "#46506E",
                rim: WOOD,
                paint: {
                    kind: "blobs",
                    colors: ["#B5EAD7", "#FFDAC1", "#E2B6F0", "#C7CEEA"],
                    opacity: 0.18,
                },
                accent: "#FFF1A8",
                late: WARN,
            },
        ],
    },
    {
        title: "Special",
        skins: [
            {
                id: "suits",
                name: "Suits",
                felt: "#0E6B3C",
                rim: WOOD,
                paint: { kind: "suits" },
                accent: GOLDEN,
                late: WARN,
            },
            {
                id: "starry",
                name: "Starry night",
                felt: "#101A3D",
                rim: "#2C2340",
                paint: { kind: "stars" },
                accent: "#FFE9A8",
                late: WARN,
            },
            {
                id: "royal",
                name: "Royal",
                felt: "#5B0F1E",
                rim: "#8A6510",
                paint: { kind: "lattice" },
                accent: "#F7D774",
                late: PALE_WARN,
            },
            {
                id: "chips",
                name: "Chips",
                felt: "#0E5E36",
                rim: WOOD,
                paint: { kind: "chips" },
                accent: GOLDEN,
                late: WARN,
            },
            {
                id: "casino",
                name: "Casino",
                felt: "#0B5A32",
                rim: "#3B2614",
                paint: { kind: "ring" },
                accent: GOLDEN,
                late: WARN,
            },
        ],
    },
];

const ALL = SKIN_SECTIONS.flatMap((s) => s.skins);

export function skinById(id: string | undefined): Skin {
    return ALL.find((s) => s.id === id) ?? ALL[0];
}

/** A small random number generator: the same seed always gives the same numbers. */
function seeded(text: string) {
    let seed = 0;
    for (const ch of text)
        seed = Math.imul(seed ^ ch.charCodeAt(0), 2654435761) >>> 0;
    return () => {
        seed = (seed + 0x6d2b79f5) >>> 0;
        let t = seed;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** A felt with its rim: `width` × `height`, rounded by `radius`. `scale` sizes the rim and the
 * pattern's details (1 is a phone-size table). */
export const Felt = memo(function Felt({
    skin: skinId,
    width,
    height,
    radius,
    scale = 1,
}: {
    skin: string | undefined;
    width: number;
    height: number;
    radius: number;
    scale?: number;
}) {
    const skin = skinById(skinId);
    const rim = 10 * scale;
    const w = Math.max(0, width - 2 * rim);
    const h = Math.max(0, height - 2 * rim);
    const pattern = useMemo(
        () => paint(skin, w, h, scale),
        [skin, w, h, scale],
    );
    return (
        <View
            style={{
                width,
                height,
                borderRadius: radius,
                borderWidth: rim,
                borderColor: skin.rim,
                backgroundColor: skin.felt,
                overflow: "hidden",
                boxShadow: `inset 0 0 ${30 * scale}px rgba(0,0,0,0.45)`,
            }}
        >
            <Svg width={w} height={h}>
                <Defs>
                    {/* A soft light in the middle, like a lamp over the table. */}
                    <RadialGradient
                        id={`light-${skin.id}`}
                        cx="50%"
                        cy="50%"
                        r="60%"
                    >
                        <Stop
                            offset="0"
                            stopColor="#FFFFFF"
                            stopOpacity={0.1}
                        />
                        <Stop
                            offset="1"
                            stopColor="#000000"
                            stopOpacity={0.15}
                        />
                    </RadialGradient>
                </Defs>
                {pattern}
                <Rect
                    x={0}
                    y={0}
                    width={w}
                    height={h}
                    fill={`url(#light-${skin.id})`}
                />
            </Svg>
        </View>
    );
});

const SUITS = ["♠", "♥", "♦", "♣"];

/** The skin's pattern on a `w` × `h` felt. */
function paint(skin: Skin, w: number, h: number, scale: number) {
    if (w <= 0 || h <= 0) return null;
    const random = seeded(skin.id);
    const between = (a: number, b: number) => a + random() * (b - a);
    const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length)];
    // How many small things fit, by area: one per `size` × `size` patch.
    const howMany = (size: number) => Math.round((w * h) / (size * scale) ** 2);
    const p = skin.paint;
    switch (p.kind) {
        case "plain":
            return null;
        case "blobs":
            // Soft round splashes of paint, overlapping.
            return Array.from({ length: 22 }, (_, i) => (
                <Ellipse
                    key={i}
                    cx={between(0, w)}
                    cy={between(0, h)}
                    rx={between(0.08, 0.2) * w}
                    ry={between(0.05, 0.13) * h}
                    fill={pick(p.colors)}
                    opacity={p.opacity}
                    transform={`rotate(${between(0, 180)} ${w / 2} ${h / 2})`}
                />
            ));
        case "strokes":
            // Wide brush strokes in curves across the felt.
            return Array.from({ length: 16 }, (_, i) => {
                const [x1, y1] = [
                    between(-0.1, 1.1) * w,
                    between(-0.1, 1.1) * h,
                ];
                const [x2, y2] = [
                    between(-0.1, 1.1) * w,
                    between(-0.1, 1.1) * h,
                ];
                const [cx, cy] = [between(0, w), between(0, h)];
                return (
                    <Path
                        key={i}
                        d={`M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`}
                        stroke={pick(p.colors)}
                        strokeWidth={between(8, 26) * scale}
                        strokeLinecap="round"
                        fill="none"
                        opacity={p.opacity}
                    />
                );
            });
        case "suits":
            // Tiny spades, hearts, diamonds and clubs all over, facing every way.
            return Array.from({ length: howMany(22) }, (_, i) => {
                const suit = pick(SUITS);
                const red = suit === "♥" || suit === "♦";
                const [x, y] = [between(0, w), between(0, h)];
                return (
                    <SvgText
                        key={i}
                        x={x}
                        y={y}
                        fontSize={between(8, 12) * scale}
                        fill={red ? "#FF8A8A" : "#FFFFFF"}
                        opacity={red ? 0.22 : 0.16}
                        textAnchor="middle"
                        transform={`rotate(${between(0, 360)} ${x} ${y})`}
                    >
                        {suit}
                    </SvgText>
                );
            });
        case "stars":
            // A night sky: many small stars, a few bright ones.
            return (
                <G>
                    {Array.from({ length: howMany(16) }, (_, i) => (
                        <Circle
                            key={i}
                            cx={between(0, w)}
                            cy={between(0, h)}
                            r={between(0.4, 1.3) * scale}
                            fill="#FFFFFF"
                            opacity={between(0.25, 0.85)}
                        />
                    ))}
                    {Array.from({ length: 6 }, (_, i) => {
                        const [x, y, r] = [
                            between(0, w),
                            between(0, h),
                            between(2.5, 4) * scale,
                        ];
                        return (
                            <Path
                                key={`b${i}`}
                                d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`}
                                fill="#FFF6D5"
                                opacity={0.9}
                            />
                        );
                    })}
                </G>
            );
        case "lattice": {
            // Gold diamonds, like a royal fabric.
            const step = 22 * scale;
            const lines = [];
            for (let x = -h; x < w + h; x += step) {
                lines.push(
                    <Line key={`a${x}`} x1={x} y1={0} x2={x + h} y2={h} />,
                );
                lines.push(
                    <Line key={`b${x}`} x1={x + h} y1={0} x2={x} y2={h} />,
                );
            }
            return (
                <G stroke={GOLD} strokeWidth={0.8 * scale} opacity={0.35}>
                    {lines}
                </G>
            );
        }
        case "chips":
            // Casino chips scattered across the felt.
            // Few and faint, so they're never mistaken for the players' chips.
            return Array.from({ length: howMany(52) }, (_, i) => {
                const [x, y, r] = [
                    between(0, w),
                    between(0, h),
                    between(3.5, 5.5) * scale,
                ];
                return (
                    <G key={i} opacity={0.22}>
                        <Circle
                            cx={x}
                            cy={y}
                            r={r}
                            fill={pick([
                                "#E04646",
                                "#2F6FE0",
                                "#22A05A",
                                "#F07F1E",
                                "#8B3FD0",
                                GOLD,
                            ])}
                        />
                        <Circle
                            cx={x}
                            cy={y}
                            r={r * 0.7}
                            fill="none"
                            stroke="#FFFFFF"
                            strokeWidth={r * 0.22}
                            strokeDasharray={`${r * 0.5} ${r * 0.5}`}
                        />
                    </G>
                );
            });
        case "ring": {
            // A classic casino felt: a thin gold line inside the edge.
            const inset = 14 * scale;
            return (
                <Rect
                    x={inset}
                    y={inset}
                    width={Math.max(0, w - 2 * inset)}
                    height={Math.max(0, h - 2 * inset)}
                    rx={Math.max(0, Math.min(w, h) / 2 - inset)}
                    fill="none"
                    stroke={GOLD}
                    strokeWidth={1.2 * scale}
                    opacity={0.6}
                />
            );
        }
    }
}
