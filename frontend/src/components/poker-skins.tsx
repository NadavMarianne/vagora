// How a poker table looks: its skin. Three kinds: plain colors, art (each after a real art
// tradition), and special ones (card suits and chips drawn in fine lines, a royal pattern...). `Felt` draws
// any of them, at any size: the table itself and the small previews to pick from. Patterns come
// from a random generator seeded by the skin's name, so a table looks the same on every phone.
//
// The colors drawn on the felt (writing, card outlines, the hourglass, the gold and the warning
// red) are never picked by hand: `inkFor` works them out from the felt's color with the contrast
// rule used for readable text on screens (WCAG's AA level). Busy felts keep their middle
// calm, where the board, the pot and the timer are, and keep away from (or fade under) the cards
// and chips in front of each player.
import { memo, type ReactElement, useMemo } from "react";
import { View } from "react-native";
import Svg, {
    Circle,
    ClipPath,
    Defs,
    G,
    Line,
    Path,
    RadialGradient,
    Rect,
    Stop,
} from "react-native-svg";

export const DEFAULT_SKIN = "green";

const WOOD = "#5A3A1F";
const GOLD = "#C9A227";

type Paint =
    | { kind: "plain" }
    | { kind: "waves" }
    | { kind: "marble" }
    | { kind: "mosaic" }
    | { kind: "cutouts" }
    | { kind: "suits" }
    | { kind: "stars" }
    | { kind: "lattice" }
    | { kind: "chips" }
    | { kind: "ring" };

/** The colors drawn on a felt, all worked out from the felt's color. */
export type Ink = {
    /** Writing: white on dark felts, near-black on light ones. */
    text: string;
    /** Quieter writing (the round's name, "Pot"). */
    soft: string;
    /** Card outlines and the hourglass's glass. */
    line: string;
    /** A see-through fill inside card outlines and the glass. */
    faint: string;
    /** A soft edge round the writing, in the opposite color, for busy felts. */
    halo: string;
    /** The pot's amount, the timer's digits and the sand: gold, as light or dark as it must be. */
    accent: string;
    /** The same in the last seconds of a turn: red, as light or dark as it must be. */
    late: string;
    /** A thin edge round chips lying on the felt, so they stand out from it. */
    edge: string;
};

type SkinDef = {
    id: string;
    name: string;
    /** The felt's main color: what everything on it is measured against. */
    felt: string;
    rim: string;
    paint: Paint;
    /** The two colors a line-drawn pattern is drawn in. */
    lines?: [string, string];
    /** The same pattern in other colors, each its own skin named `<id>-<key>`. */
    colors?: Color[];
};

/** Another color of a special felt. */
type Color = { key: string; name: string; felt: string; rim?: string; lines?: [string, string] };

export type Skin = Omit<SkinDef, "colors"> & {
    ink: Ink;
    /** The skin and its other colors, the skin first (special felts only). */
    family: Skin[];
};

const DEFS: { title: string; skins: SkinDef[] }[] = [
    {
        title: "Colors",
        skins: [
            { id: "green", name: "Green", felt: "#0E6B3C", rim: WOOD, paint: { kind: "plain" } },
            { id: "blue", name: "Blue", felt: "#14507F", rim: WOOD, paint: { kind: "plain" } },
            { id: "red", name: "Red", felt: "#7E1F2B", rim: WOOD, paint: { kind: "plain" } },
            { id: "orange", name: "Orange", felt: "#A84E17", rim: WOOD, paint: { kind: "plain" } },
            { id: "purple", name: "Purple", felt: "#4B2A7B", rim: WOOD, paint: { kind: "plain" } },
            { id: "black", name: "Black", felt: "#1E2126", rim: "#3A2A1C", paint: { kind: "plain" } },
            { id: "white", name: "White", felt: "#ECE8DF", rim: WOOD, paint: { kind: "plain" } },
        ],
    },
    {
        title: "Artistic",
        skins: [
            // The Japanese seigaiha wave pattern, in tones of indigo.
            { id: "waves", name: "Waves", felt: "#1A3768", rim: "#3B2A1C", paint: { kind: "waves" } },
            // Black marble with white and gold veins.
            { id: "marble", name: "Marble", felt: "#1C1F22", rim: "#2B2B2E", paint: { kind: "marble" } },
            // Gold tiles and spirals on a dark ground, after Klimt's golden period.
            { id: "mosaic", name: "Mosaic", felt: "#221A0E", rim: "#6B4E12", paint: { kind: "mosaic" } },
            // Bright paper shapes on cobalt, after Matisse's cut-outs.
            { id: "cutouts", name: "Cutouts", felt: "#1E3E92", rim: WOOD, paint: { kind: "cutouts" } },
            // A night sky with a moon and a small constellation.
            { id: "starry", name: "Starry night", felt: "#101A3D", rim: "#2C2340", paint: { kind: "stars" } },
        ],
    },
    {
        title: "Special",
        skins: [
            // Card suits drawn in fine lines, in even rows: the red suits in the first color, the
            // black ones in the second.
            {
                id: "suits",
                name: "Suits",
                felt: "#F3EEE4",
                rim: WOOD,
                paint: { kind: "suits" },
                lines: ["#C8323A", "#3A3A3A"],
                colors: [
                    { key: "white", name: "White", felt: "#FBFAF7", lines: ["#C8323A", "#3A3A3A"] },
                    { key: "black", name: "Black", felt: "#1C1D21", rim: "#3A2A1C", lines: ["#E86A72", "#D6D3CC"] },
                    { key: "green", name: "Green", felt: "#0E6B3C", lines: ["#F6B1B5", "#F3EBD3"] },
                    { key: "blue", name: "Blue", felt: "#14507F", lines: ["#F6B1B5", "#F3EBD3"] },
                ],
            },
            // Chips drawn in fine lines, in even rows, the two colors taking turns.
            {
                id: "chips",
                name: "Chips",
                felt: "#0E5E36",
                rim: WOOD,
                paint: { kind: "chips" },
                lines: ["#F3EBD3", GOLD],
                colors: [
                    { key: "blue", name: "Blue", felt: "#14507F", lines: ["#F3EBD3", GOLD] },
                    { key: "red", name: "Red", felt: "#7E1F2B", lines: ["#F3EBD3", GOLD] },
                    { key: "black", name: "Black", felt: "#1C1D21", rim: "#3A2A1C", lines: [GOLD, "#D6D3CC"] },
                    { key: "cream", name: "Cream", felt: "#F3EEE4", lines: ["#C8323A", "#3A3A3A"] },
                ],
            },
            {
                id: "royal",
                name: "Royal",
                felt: "#5B0F1E",
                rim: "#8A6510",
                paint: { kind: "lattice" },
                colors: [
                    { key: "navy", name: "Navy", felt: "#13264D" },
                    { key: "emerald", name: "Emerald", felt: "#0B4A33" },
                    { key: "purple", name: "Purple", felt: "#3A1F5C" },
                    { key: "black", name: "Black", felt: "#17171B" },
                ],
            },
            {
                id: "casino",
                name: "Casino",
                felt: "#0B5A32",
                rim: "#3B2614",
                paint: { kind: "ring" },
                colors: [
                    { key: "blue", name: "Blue", felt: "#124A78" },
                    { key: "red", name: "Red", felt: "#741C28" },
                    { key: "purple", name: "Purple", felt: "#432570" },
                    { key: "black", name: "Black", felt: "#1C1F24" },
                ],
            },
        ],
    },
];

// ---- The color rule ----

const WHITE = "#FFFFFF";
const DARK = "#15171C";
/** The least contrast allowed between the felt and what's on it, by WCAG's AA level: 4.5 to 1
 * for normal writing, 3 to 1 for large bold writing and for shapes. The gold and the red are used
 * for the pot's and the timer's large bold digits and for the sand, so they need 3 to 1. */
const MIN_CONTRAST = { text: 4.5, large: 3 };
const GOLD_HUE = { hue: 45, saturation: 0.8 };
const RED_HUE = { hue: 4, saturation: 0.85 };

function rgbOf(hex: string): [number, number, number] {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** How bright a color looks to the eye, from 0 (black) to 1 (white), as WCAG measures it. */
function luminance(hex: string) {
    const [r, g, b] = rgbOf(hex).map((c) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** How far apart two colors are for reading, from 1 (the same) to 21 (black on white). */
export function contrast(a: string, b: string) {
    const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
}

/** A color from its hue (0 to 360), saturation and lightness (0 to 1). */
function hsl(hue: number, s: number, l: number) {
    const k = (n: number) => (n + hue / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    const hex = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
    return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`.toUpperCase();
}

/** A hue at its natural lightness, made lighter (on a dark felt) or darker (on a light one),
 * step by step, until it reads on the felt. */
function readable(felt: string, { hue, saturation }: { hue: number; saturation: number }, darkFelt: boolean) {
    for (let step = 0; step <= 50; step++) {
        const color = hsl(hue, saturation, darkFelt ? 0.5 + step * 0.01 : 0.5 - step * 0.01);
        if (contrast(color, felt) >= MIN_CONTRAST.large) return color;
    }
    return darkFelt ? WHITE : DARK;
}

/** Everything drawn on a felt, from the felt's color alone. */
export function inkFor(felt: string): Ink {
    const darkFelt = contrast(WHITE, felt) >= contrast(DARK, felt);
    const [r, g, b] = rgbOf(darkFelt ? WHITE : DARK);
    const see = (alpha: number) => `rgba(${r},${g},${b},${alpha})`;
    return {
        text: darkFelt ? WHITE : DARK,
        soft: see(0.78),
        line: see(0.72),
        faint: see(0.1),
        halo: darkFelt ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.75)",
        accent: readable(felt, GOLD_HUE, darkFelt),
        late: readable(felt, RED_HUE, darkFelt),
        edge: see(darkFelt ? 0.4 : 0.3),
    };
}

/** A skin and its other colors, ready to draw. */
function withColors({ colors = [], ...def }: SkinDef): Skin {
    const family: Skin[] = [];
    const skin: Skin = { ...def, ink: inkFor(def.felt), family };
    family.push(
        skin,
        ...colors.map(({ key, name, ...color }) => {
            const other = { ...def, ...color, id: `${def.id}-${key}`, name: `${def.name} · ${name}` };
            return { ...other, ink: inkFor(other.felt), family };
        }),
    );
    return skin;
}

/** Every skin, in the sections the picker shows (other colors inside each skin's `family`). The
 * names match the backend's list. */
export const SKIN_SECTIONS: { title: string; skins: Skin[] }[] = DEFS.map((section) => ({
    title: section.title,
    skins: section.skins.map(withColors),
}));

const ALL = SKIN_SECTIONS.flatMap((s) => s.skins.flatMap((skin) => skin.family));

/** A skin by its name; an unknown name (say, one that was removed) gets the default. */
export function skinById(id: string | undefined): Skin {
    return ALL.find((s) => s.id === id) ?? ALL[0];
}

// ---- Drawing ----

/** A small random number generator: the same seed always gives the same numbers. */
function seeded(text: string) {
    let seed = 0;
    for (const ch of text) seed = Math.imul(seed ^ ch.charCodeAt(0), 2654435761) >>> 0;
    return () => {
        seed = (seed + 0x6d2b79f5) >>> 0;
        let t = seed;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Real felt gets a soft light in the middle, like a lamp over the table; printed art doesn't. */
const LAMP: Paint["kind"][] = ["plain", "suits", "stars", "lattice", "chips", "ring"];

/** A place on the felt, from its top-left corner (rim included). */
export type Spot = { x: number; y: number; w: number; h: number };

/** A felt with its rim: `width` × `height`, rounded by `radius`. `scale` sizes the rim and the
 * pattern's details (1 is a phone-size table). Patterns keep away from (or fade under) the `clear`
 * spots, where the players' cards and chips lie. */
export const Felt = memo(function Felt({
    skin: skinId,
    width,
    height,
    radius,
    scale = 1,
    clear = NONE,
}: {
    skin: string | undefined;
    width: number;
    height: number;
    radius: number;
    scale?: number;
    clear?: Spot[];
}) {
    const skin = skinById(skinId);
    const rim = 10 * scale;
    const w = Math.max(0, width - 2 * rim);
    const h = Math.max(0, height - 2 * rim);
    const pattern = useMemo(
        () => paint(skin, w, h, scale, clear.map((c) => ({ ...c, x: c.x - rim, y: c.y - rim }))),
        [skin, w, h, scale, clear, rim],
    );
    const lamp = LAMP.includes(skin.paint.kind);
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
                boxShadow: `inset 0 0 ${(lamp ? 30 : 14) * scale}px rgba(0,0,0,${lamp ? 0.45 : 0.3})`,
            }}
        >
            <Svg width={w} height={h}>
                {lamp && (
                    <Defs>
                        <RadialGradient id={`light-${skin.id}`} cx="50%" cy="50%" r="60%">
                            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.1} />
                            <Stop offset="1" stopColor="#000000" stopOpacity={0.15} />
                        </RadialGradient>
                    </Defs>
                )}
                {pattern}
                {lamp && <Rect x={0} y={0} width={w} height={h} fill={`url(#light-${skin.id})`} />}
            </Svg>
        </View>
    );
});

const NONE: Spot[] = [];

// ---- Fine line drawings (the suits and chips felts) ----

/** The four suits as outlines in a 2 × 2 box round (0, 0). */
const SUIT_SHAPES = {
    heart: "M0 0.92 C-0.35 0.62 -1 0.22 -1 -0.32 C-1 -0.8 -0.42 -1 0 -0.55 C0.42 -1 1 -0.8 1 -0.32 C1 0.22 0.35 0.62 0 0.92 Z",
    diamond: "M0 -1 Q0.3 -0.38 0.74 0 Q0.3 0.38 0 1 Q-0.3 0.38 -0.74 0 Q-0.3 -0.38 0 -1 Z",
    spade: "M0 -1 C0.35 -0.62 1 -0.22 1 0.22 C1 0.62 0.5 0.75 0.12 0.45 Q0.14 0.82 0.4 0.96 L-0.4 0.96 Q-0.14 0.82 -0.12 0.45 C-0.5 0.75 -1 0.62 -1 0.22 C-1 -0.22 -0.35 -0.62 0 -1 Z",
    // Three round leaves (circles of radius 0.4) on a stem.
    club: "M-0.36 -0.245 A0.4 0.4 0 1 1 0.36 -0.245 A0.4 0.4 0 1 1 0.1 0.39 Q0.12 0.8 0.38 0.96 L-0.38 0.96 Q-0.12 0.8 -0.1 0.39 A0.4 0.4 0 1 1 -0.36 -0.245 Z",
};
const ROUND = "M-1 0 A1 1 0 1 1 1 0 A1 1 0 1 1 -1 0 Z";
/** A chip's six inlays round its edge, as outlines. */
const INLAYS = Array.from({ length: 6 }, (_, k) => {
    const a = (k * Math.PI) / 3 + Math.PI / 6;
    const at = (r: number, side: number) =>
        `${(Math.cos(a) * r - Math.sin(a) * side).toFixed(3)} ${(Math.sin(a) * r + Math.cos(a) * side).toFixed(3)}`;
    return `M${at(0.68, -0.13)} L${at(0.95, -0.11)} L${at(0.95, 0.11)} L${at(0.68, 0.13)} Z`;
}).join(" ");

const ARGS: Record<string, number> = { M: 2, L: 2, C: 6, Q: 4, A: 7, Z: 0 };
const r1 = (v: number) => Math.round(v * 10) / 10;

/** A shape from the 2 × 2 box above, `s` times as big, its middle at (x, y). */
function place(d: string, x: number, y: number, s: number) {
    const tokens = d.match(/[MLCQAZ]|-?\d*\.?\d+/g) ?? [];
    let out = "";
    for (let i = 0; i < tokens.length; ) {
        const cmd = tokens[i++];
        const n = tokens.slice(i, i + ARGS[cmd]).map(Number);
        i += ARGS[cmd];
        out +=
            cmd === "A"
                ? `A${r1(n[0] * s)} ${r1(n[1] * s)} 0 ${n[3]} ${n[4]} ${r1(x + n[5] * s)} ${r1(y + n[6] * s)}`
                : cmd + n.map((v, k) => r1(k % 2 ? y + v * s : x + v * s)).join(" ");
    }
    return out;
}

/** One drawing in a line-drawn pattern: an outline, `inner` another outline inside it (a share of
 * its size), maybe a dotted line between the two and `extra` outlines, and inside the inner one a
 * few crossing lines and a hatched band, like a pen drawing. */
type Sketch = {
    shape: string;
    extra?: string;
    inner: number;
    /** Where the dotted line runs, as a share of the size. */
    dots?: number;
    /** Crossing lines and hatching inside, or else `mark`, a small shape in the middle. */
    hatch: boolean;
    mark?: string;
    color: string;
    x: number;
    y: number;
    s: number;
    faded: boolean;
};

/** Draws many sketches: one shape per color for their outlines, dots and inside lines, so even
 * a hundred drawings stay light. Small felts (the previews) get the outlines only. */
function sketches(list: Sketch[], id: string, scale: number, opacity: number, random: () => number, dotGap = 3.2 * scale) {
    const groups = new Map<string, { color: string; faded: boolean; outline: string; dots: string; clip: string; lines: string }>();
    const fine = scale >= 0.6;
    for (const it of list) {
        const key = `${it.color}${it.faded}`;
        const g = groups.get(key) ?? { color: it.color, faded: it.faded, outline: "", dots: "", clip: "", lines: "" };
        groups.set(key, g);
        g.outline += place(it.shape, it.x, it.y, it.s) + place(it.shape, it.x, it.y, it.s * it.inner);
        if (it.extra) g.outline += place(it.extra, it.x, it.y, it.s);
        if (!fine) continue;
        if (it.dots) g.dots += place(it.shape, it.x, it.y, it.s * it.dots);
        if (it.mark) g.outline += place(it.mark, it.x, it.y, it.s * 0.3);
        if (!it.hatch) continue;
        g.clip += place(it.shape, it.x, it.y, it.s * it.inner);
        // Lines through the drawing, long enough to cross it; the inner outline clips them.
        const line = (px: number, py: number, a: number) => {
            const [dx, dy] = [Math.cos(a) * 1.6, Math.sin(a) * 1.6];
            g.lines += `M${r1(it.x + (px - dx) * it.s)} ${r1(it.y + (py - dy) * it.s)}L${r1(it.x + (px + dx) * it.s)} ${r1(it.y + (py + dy) * it.s)}`;
        };
        for (let k = 0; k < 3; k++) line(random() * 0.8 - 0.4, random() * 0.8 - 0.4, random() * Math.PI);
        // A hatched band: four lines side by side.
        const a = random() * Math.PI;
        const from = random() * 0.6 - 0.5;
        for (let k = 0; k < 4; k++) {
            const o = from + k * 0.11;
            line(-Math.sin(a) * o, Math.cos(a) * o, a);
        }
    }
    return [...groups.values()].map((g, i) => (
        <G key={i} opacity={g.faded ? opacity * 0.3 : opacity}>
            <Path d={g.outline} stroke={g.color} strokeWidth={1.1 * scale} fill="none" strokeLinejoin="round" />
            {g.dots !== "" && (
                <Path d={g.dots} stroke={g.color} strokeWidth={1.5 * scale} strokeDasharray={`0 ${dotGap}`} strokeLinecap="round" fill="none" />
            )}
            {g.clip !== "" && (
                <>
                    <Defs>
                        <ClipPath id={`${id}-${i}`}>
                            <Path d={g.clip} />
                        </ClipPath>
                    </Defs>
                    <G clipPath={`url(#${id}-${i})`}>
                        <Path d={g.lines} stroke={g.color} strokeWidth={0.6 * scale} fill="none" />
                    </G>
                </>
            )}
        </G>
    ));
}

/** A closed, smooth shape through `points` (a Catmull-Rom curve drawn as Béziers). */
function smooth(points: [number, number][]) {
    const n = points.length;
    const at = (i: number) => points[(i + n) % n];
    let d = `M${at(0)[0]} ${at(0)[1]}`;
    for (let i = 0; i < n; i++) {
        const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
        const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += ` C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`;
    }
    return `${d} Z`;
}

/** The skin's pattern on a `w` × `h` felt. */
function paint(skin: Skin, w: number, h: number, scale: number, clear: Spot[]) {
    if (w <= 0 || h <= 0) return null;
    const random = seeded(skin.id);
    const between = (a: number, b: number) => a + random() * (b - a);
    const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length)];
    // How many small things fit, by area: one per `size` × `size` patch.
    const howMany = (size: number) => Math.round((w * h) / (size * scale) ** 2);
    // The calm middle of busy felts, where the board, the pot and the timer are.
    const calm = (x: number, y: number, grow = 0) =>
        ((x - w / 2) / (w * 0.3 + grow)) ** 2 + ((y - h / 2) / (h * 0.2 + grow)) ** 2 < 1;
    // Whether a round thing at (x, y), `r` across from its middle, touches a clear spot.
    const nearClear = (x: number, y: number, r: number) =>
        clear.some((c) => {
            const dx = Math.max(c.x - x, 0, x - c.x - c.w);
            const dy = Math.max(c.y - y, 0, y - c.y - c.h);
            return dx * dx + dy * dy < (r + 4 * scale) ** 2;
        });
    // A size that keeps a composition the same at any size (the table and its preview).
    const size = Math.sqrt(w * h);
    // Even rows of drawings, every other row shifted half a step, centered on the felt.
    const rows = (r: number, each: (x: number, y: number, row: number, column: number) => void) => {
        const [dx, dy] = [3.6 * r, 3.1 * r];
        const [columns, lines] = [Math.ceil(w / dx) + 1, Math.ceil(h / dy) + 1];
        for (let row = 0; row < lines; row++)
            for (let column = 0; column < columns; column++) {
                const x = w / 2 + (column - (columns - 1) / 2) * dx + (row % 2 ? dx / 2 : 0);
                const y = h / 2 + (row - (lines - 1) / 2) * dy;
                each(x, y, row, column);
            }
    };
    switch (skin.paint.kind) {
        case "plain":
            return null;

        case "waves": {
            // Rows of fans, each row tucked under the one above, rings in tones of indigo. A row's
            // fans don't overlap, so each ring of a row is one shape.
            const r = 28 * scale;
            const rings = ["#183463", "#1F4277", "#27508C", "#3462A0"];
            const circle = (x: number, y: number, radius: number) =>
                `M${x - radius} ${y} a${radius} ${radius} 0 1 0 ${2 * radius} 0 a${radius} ${radius} 0 1 0 ${-2 * radius} 0 Z`;
            const rows = [];
            for (let row = -1; row * r * 0.5 < h + r; row++) {
                const y = row * r * 0.5;
                const shift = row % 2 === 0 ? 0 : r;
                const xs: number[] = [];
                for (let x = -r + shift; x < w + r; x += 2 * r) xs.push(x);
                rows.push(
                    <G key={row}>
                        {rings.map((fill, i) => (
                            <Path
                                key={i}
                                d={xs.map((x) => circle(x, y, r * (1 - i * 0.22))).join(" ")}
                                fill={fill}
                                stroke="#DCE6F2"
                                strokeWidth={0.9 * scale}
                                strokeOpacity={0.35}
                            />
                        ))}
                    </G>,
                );
            }
            return rows;
        }

        case "marble": {
            // Veins flowing one way across the stone, as in real marble: many thin and faint, a few
            // bold ones that split, and one of gold.
            const flow = between(1.0, 1.25);
            const veins: ReactElement[] = [];
            const vein = (key: string, x: number, y: number, width: number, color: string, opacity: number, branches: number) => {
                let angle = flow + between(-0.25, 0.25);
                const points: [number, number][] = [[x, y]];
                while (x > -w * 0.6 && x < w * 1.6 && y < h * 1.1 && points.length < 60) {
                    angle = flow + (angle - flow) * 0.6 + between(-0.25, 0.25);
                    const length = between(0.03, 0.07) * size;
                    x += Math.cos(angle) * length;
                    y += Math.sin(angle) * length;
                    points.push([x, y]);
                    if (branches > 0 && random() < 0.15) {
                        branches--;
                        vein(`${key}-${points.length}`, x, y, width * 0.5, color, opacity * 0.8, 0);
                    }
                }
                let d = `M${points[0][0]} ${points[0][1]}`;
                for (let i = 1; i < points.length; i++) {
                    const [px, py] = points[i - 1];
                    const [qx, qy] = points[i];
                    d += ` Q${px} ${py} ${(px + qx) / 2} ${(py + qy) / 2}`;
                }
                veins.push(<Path key={key} d={d} stroke={color} strokeWidth={width} strokeOpacity={opacity} fill="none" strokeLinecap="round" strokeLinejoin="round" />);
            };
            // Each vein starts above the top edge, spread across it (bold ones evenly), and runs
            // down the table's length.
            const start = (share: number): [number, number] => [(share * 1.6 - 0.6) * w, between(-0.25, -0.02) * h];
            for (let i = 0; i < 7; i++) vein(`t${i}`, ...start(random()), between(0.4, 0.8) * scale, "#D9D4C8", between(0.2, 0.32), 0);
            for (let i = 0; i < 3; i++) vein(`w${i}`, ...start((i + between(0.2, 0.8)) / 3), between(1.4, 2.4) * scale, "#EEE9DE", between(0.5, 0.7), 1);
            vein("g", ...start(between(0.3, 0.7)), 1.3 * scale, GOLD, 0.8, 1);
            return veins;
        }

        case "mosaic": {
            // A gold mosaic: small square tiles side by side in gold tones, a few of other colors,
            // and spirals set into it. The middle stays plain. Tiles of one color are one shape.
            const cell = 8 * scale;
            const gap = Math.max(0.5, 1.2 * scale);
            const tones = [GOLD, "#E8C547", "#B8892B", "#9C7414", "#F1D77E", "#2F7F79", "#A3322A", "#E8E2CF"];
            const paths = tones.map(() => [] as string[]);
            for (let x = 0; x < w; x += cell)
                for (let y = 0; y < h; y += cell) {
                    if (calm(x + cell / 2, y + cell / 2) || nearClear(x + cell / 2, y + cell / 2, cell) || random() < 0.12) continue;
                    const tone = random() < 0.06 ? 5 + Math.floor(random() * 3) : Math.floor(random() * 5);
                    const side = cell - gap;
                    paths[tone].push(`M${x} ${y}h${side}v${side}h${-side}Z`);
                }
            const spirals = [];
            for (let i = 0; i < 60 && spirals.length < 10; i++) {
                const [x, y, r] = [between(0, w), between(0, h), between(0.03, 0.05) * size];
                if (calm(x, y, r) || nearClear(x, y, r)) continue;
                spirals.push(
                    <G key={`s${i}`}>
                        <Circle cx={x} cy={y} r={r} fill="#14100A" />
                        {[0.85, 0.6, 0.35].map((k) => (
                            <Circle key={k} cx={x} cy={y} r={r * k} fill="none" stroke="#E8C547" strokeWidth={r * 0.1} />
                        ))}
                        <Circle cx={x} cy={y} r={r * 0.12} fill="#E8C547" />
                    </G>,
                );
            }
            return [...tones.map((fill, i) => <Path key={fill} d={paths[i].join("")} fill={fill} />), ...spirals];
        }

        case "cutouts": {
            // Leafy shapes cut from colored paper with rounded lobes, and a few dots, round a
            // calm middle.
            const shapes = [];
            for (let i = 0; i < 400 && shapes.length < 12; i++) {
                const [x, y, r] = [between(-0.12, 1.12) * w, between(-0.12, 1.12) * h, between(0.08, 0.14) * size];
                if (calm(x, y, r * 0.8) || nearClear(x, y, r * 0.75)) continue;
                const lobes = 4 + Math.floor(random() * 4);
                const turn = between(0, Math.PI * 2);
                const points: [number, number][] = [];
                for (let k = 0; k < lobes; k++) {
                    const angle = turn + (k * 2 * Math.PI) / lobes;
                    const reach = r * between(0.8, 1.1);
                    const half = Math.PI / lobes;
                    // Each lobe: two points round its tip, then a dip before the next one.
                    points.push([x + Math.cos(angle - half * 0.35) * reach, y + Math.sin(angle - half * 0.35) * reach]);
                    points.push([x + Math.cos(angle + half * 0.35) * reach, y + Math.sin(angle + half * 0.35) * reach]);
                    const dip = r * between(0.45, 0.6);
                    points.push([x + Math.cos(angle + half) * dip, y + Math.sin(angle + half) * dip]);
                }
                shapes.push(<Path key={i} d={smooth(points)} fill={pick(["#F6F1E7", "#F2B705", "#E8505B", "#2BA84A", "#111111", "#F28C28"])} />);
            }
            for (let i = 0; i < 200 && shapes.length < 22; i++) {
                const [x, y] = [between(0, w), between(0, h)];
                if (calm(x, y, 6 * scale) || nearClear(x, y, 6 * scale)) continue;
                shapes.push(<Circle key={`d${i}`} cx={x} cy={y} r={between(0.012, 0.02) * size} fill={pick(["#F6F1E7", "#F2B705", "#E8505B"])} />);
            }
            return shapes;
        }

        case "suits": {
            // Card suits drawn in fine lines, like a pen drawing: an outline, a dotted line and a
            // second outline inside it, and crossing lines and hatching within. Even rows of hearts
            // and clubs, then spades and diamonds; none in the middle, faint under the players'
            // cards and chips.
            const r = 12 * scale;
            const list: Sketch[] = [];
            rows(r, (x, y, row, column) => {
                if (calm(x, y, r)) return;
                const suit = row % 2 ? (column % 2 ? "diamond" : "spade") : column % 2 ? "club" : "heart";
                const red = suit === "heart" || suit === "diamond";
                const [reds, blacks] = skin.lines ?? ["#C8323A", "#3A3A3A"];
                list.push({ shape: SUIT_SHAPES[suit], inner: 0.74, dots: 0.87, hatch: true, color: red ? reds : blacks, x, y, s: r, faded: nearClear(x, y, r) });
            });
            return sketches(list, `${skin.id}-${Math.round(w)}`, scale, 0.6, random);
        }

        case "stars": {
            // A night sky: many small stars, a few bright ones, a small constellation in a corner,
            // and a moon in the other.
            const corner = { x: w * between(0.08, 0.2), y: h * between(0.7, 0.78) };
            const route = Array.from({ length: 5 }, (_, i) => [corner.x + (i / 4) * w * 0.28, corner.y + between(-0.05, 0.05) * h, between(2.2, 3.2) * scale]);
            const bright = [...route, ...Array.from({ length: 4 }, () => [between(0.05, 0.95) * w, between(0.05, 0.95) * h, between(2.5, 4) * scale])].filter(
                ([x, y], i) => i < 5 || !calm(x, y),
            );
            const moon = { x: w * 0.8, y: h * 0.13, r: 0.045 * size };
            return (
                <G>
                    {Array.from({ length: howMany(16) }, (_, i) => (
                        <Circle key={i} cx={between(0, w)} cy={between(0, h)} r={between(0.4, 1.3) * scale} fill="#FFFFFF" opacity={between(0.25, 0.85)} />
                    ))}
                    <Path d={route.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ")} stroke="#FFF6D5" strokeWidth={0.7 * scale} strokeOpacity={0.35} fill="none" />
                    {bright.map(([x, y, r], i) => (
                        <Path
                            key={`b${i}`}
                            d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`}
                            fill="#FFF6D5"
                            opacity={0.9}
                        />
                    ))}
                    <Circle cx={moon.x} cy={moon.y} r={moon.r} fill="#FFF3C4" opacity={0.92} />
                    <Circle cx={moon.x + moon.r * 0.42} cy={moon.y - moon.r * 0.22} r={moon.r * 0.88} fill={skin.felt} />
                </G>
            );
        }

        case "lattice": {
            // Gold diamonds, like a royal fabric, with a gold dot where the lines cross.
            const step = 22 * scale;
            const lines = [];
            const dots = [];
            for (let x = -h; x < w + h; x += step) {
                lines.push(<Line key={`a${x}`} x1={x} y1={0} x2={x + h} y2={h} />);
                lines.push(<Line key={`b${x}`} x1={x + h} y1={0} x2={x} y2={h} />);
            }
            const count = Math.ceil((w + 2 * h) / step) + 1;
            for (let m = 0; m < count; m++)
                for (let n = 0; n < count; n++) {
                    const x = (n * step + m * step - h) / 2;
                    const y = (n * step - m * step + h) / 2;
                    if (x >= 0 && x <= w && y >= 0 && y <= h)
                        dots.push(<Circle key={`${m}-${n}`} cx={x} cy={y} r={1.3 * scale} fill={GOLD} opacity={0.6} />);
                }
            return (
                <G>
                    <G stroke={GOLD} strokeWidth={0.8 * scale} opacity={0.4}>
                        {lines}
                    </G>
                    {dots}
                </G>
            );
        }

        case "chips": {
            // Chips drawn in fine lines, in even rows, each like a real chip: an outline with six
            // inlays round the edge, an inner ring, a ring of dots, and a small suit in the middle.
            // None in the middle of the table, faint under the players' cards and chips.
            const r = 11 * scale;
            const list: Sketch[] = [];
            const suits = [SUIT_SHAPES.spade, SUIT_SHAPES.heart, SUIT_SHAPES.club, SUIT_SHAPES.diamond];
            const [first, second] = skin.lines ?? ["#F3EBD3", GOLD];
            rows(r, (x, y, row, column) => {
                if (calm(x, y, r)) return;
                list.push({
                    shape: ROUND,
                    extra: INLAYS,
                    inner: 0.6,
                    dots: 0.47,
                    hatch: false,
                    mark: suits[(column + 2 * row) % 4],
                    color: (row + column) % 2 ? second : first,
                    x,
                    y,
                    s: r,
                    faded: nearClear(x, y, r),
                });
            });
            // Twelve dots round each ring, evenly.
            return sketches(list, `${skin.id}-${Math.round(w)}`, scale, 0.5, random, (2 * Math.PI * 0.47 * r) / 12);
        }

        case "ring": {
            // A classic casino felt: two gold lines inside the edge.
            return [14, 20].map((at, i) => {
                const inset = at * scale;
                return (
                    <Rect
                        key={at}
                        x={inset}
                        y={inset}
                        width={Math.max(0, w - 2 * inset)}
                        height={Math.max(0, h - 2 * inset)}
                        rx={Math.max(0, Math.min(w, h) / 2 - inset)}
                        fill="none"
                        stroke={GOLD}
                        strokeWidth={(i === 0 ? 1.4 : 0.7) * scale}
                        opacity={i === 0 ? 0.7 : 0.45}
                    />
                );
            });
        }
    }
}
