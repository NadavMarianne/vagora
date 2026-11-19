// How a poker table looks: its skin. Three kinds: plain colors, art (each after a real art
// tradition), and special ones (little card suits, a starry night, a royal pattern...). `Felt` draws
// any of them, at any size: the table itself and the small previews to pick from. Patterns come
// from a random generator seeded by the skin's name, so a table looks the same on every phone.
//
// The colors drawn on the felt (writing, card outlines, the hourglass, the gold and the warning
// red) are never picked by hand: `inkFor` works them out from the felt's color with the contrast
// rule used for readable text on screens (WCAG's AA level). Busy felts keep their middle
// calm, where the board, the pot and the timer are.
import { memo, type ReactElement, useMemo } from "react";
import { View } from "react-native";
import Svg, {
    Circle,
    Defs,
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
    | { kind: "blocks" }
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
};

type SkinDef = {
    id: string;
    name: string;
    /** The felt's main color: what everything on it is measured against. */
    felt: string;
    rim: string;
    paint: Paint;
};

export type Skin = SkinDef & { ink: Ink };

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
            // Primary-color blocks between thick black lines, after Mondrian.
            { id: "blocks", name: "Blocks", felt: "#F1ECE0", rim: "#1A1A1A", paint: { kind: "blocks" } },
            // The Japanese seigaiha wave pattern, in tones of indigo.
            { id: "waves", name: "Waves", felt: "#1A3768", rim: "#3B2A1C", paint: { kind: "waves" } },
            // Black marble with white and gold veins.
            { id: "marble", name: "Marble", felt: "#1C1F22", rim: "#2B2B2E", paint: { kind: "marble" } },
            // Gold tiles and spirals on a dark ground, after Klimt's golden period.
            { id: "mosaic", name: "Mosaic", felt: "#221A0E", rim: "#6B4E12", paint: { kind: "mosaic" } },
            // Bright paper shapes on cobalt, after Matisse's cut-outs.
            { id: "cutouts", name: "Cutouts", felt: "#1E3E92", rim: WOOD, paint: { kind: "cutouts" } },
        ],
    },
    {
        title: "Special",
        skins: [
            { id: "suits", name: "Suits", felt: "#0E6B3C", rim: WOOD, paint: { kind: "suits" } },
            { id: "starry", name: "Starry night", felt: "#101A3D", rim: "#2C2340", paint: { kind: "stars" } },
            { id: "royal", name: "Royal", felt: "#5B0F1E", rim: "#8A6510", paint: { kind: "lattice" } },
            { id: "chips", name: "Chips", felt: "#0E5E36", rim: WOOD, paint: { kind: "chips" } },
            { id: "casino", name: "Casino", felt: "#0B5A32", rim: "#3B2614", paint: { kind: "ring" } },
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
    };
}

/** Every skin, in the sections the picker shows. The names match the backend's list. */
export const SKIN_SECTIONS: { title: string; skins: Skin[] }[] = DEFS.map((section) => ({
    title: section.title,
    skins: section.skins.map((skin) => ({ ...skin, ink: inkFor(skin.felt) })),
}));

const ALL = SKIN_SECTIONS.flatMap((s) => s.skins);

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
    const pattern = useMemo(() => paint(skin, w, h, scale), [skin, w, h, scale]);
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

const SUITS = ["♠", "♥", "♦", "♣"];

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
function paint(skin: Skin, w: number, h: number, scale: number) {
    if (w <= 0 || h <= 0) return null;
    const random = seeded(skin.id);
    const between = (a: number, b: number) => a + random() * (b - a);
    const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length)];
    // How many small things fit, by area: one per `size` × `size` patch.
    const howMany = (size: number) => Math.round((w * h) / (size * scale) ** 2);
    // The calm middle of busy felts, where the board, the pot and the timer are.
    const calm = (x: number, y: number, grow = 0) =>
        ((x - w / 2) / (w * 0.3 + grow)) ** 2 + ((y - h / 2) / (h * 0.2 + grow)) ** 2 < 1;
    // A size that keeps a composition the same at any size (the table and its preview).
    const size = Math.sqrt(w * h);
    switch (skin.paint.kind) {
        case "plain":
            return null;

        case "blocks": {
            // A big cream block in the middle (where the board and the pot are), framed by
            // rows and columns of blocks, a few of them red, blue and yellow, all between thick
            // black lines.
            const [left, right, top, bottom] = [0.2 * w, 0.8 * w, 0.32 * h, 0.68 * h];
            type Piece = { x: number; y: number; w: number; h: number };
            const frame: Piece[] = [
                { x: 0, y: 0, w, h: top },
                { x: 0, y: bottom, w, h: h - bottom },
                { x: 0, y: top, w: left, h: bottom - top },
                { x: right, y: top, w: w - right, h: bottom - top },
            ];
            const pieces: Piece[] = [];
            const split = (p: Piece, times: number) => {
                if (times === 0) return pieces.push(p);
                const cut = between(0.3, 0.7);
                if (p.w > p.h)
                    [{ ...p, w: p.w * cut }, { ...p, x: p.x + p.w * cut, w: p.w * (1 - cut) }].forEach((q) => split(q, times - 1));
                else [{ ...p, h: p.h * cut }, { ...p, y: p.y + p.h * cut, h: p.h * (1 - cut) }].forEach((q) => split(q, times - 1));
            };
            frame.forEach((p, i) => split(p, i < 2 ? 2 : 1));
            const order = pieces.map((_, i) => i).sort(() => random() - 0.5);
            const colors = new Map<number, string>();
            ["#D52B1E", "#1C4E9C", "#F4C51F", "#D52B1E", "#1C4E9C"].forEach((c, i) => colors.set(order[i], c));
            const line = Math.max(1, 5 * scale);
            return [...pieces, { x: left, y: top, w: right - left, h: bottom - top }].map((p, i) => (
                <Rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill={colors.get(i) ?? skin.felt} stroke="#111111" strokeWidth={line} />
            ));
        }

        case "waves": {
            // Rows of fans, each row tucked under the one above, rings in tones of indigo. A row's
            // fans don't overlap, so each ring of a row is one shape.
            const r = 28 * scale;
            const rings = ["#16305C", "#22477F", "#2F5F9E", "#4B7DBA"];
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
                                strokeOpacity={0.5}
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
                    if (calm(x + cell / 2, y + cell / 2) || random() < 0.12) continue;
                    const tone = random() < 0.06 ? 5 + Math.floor(random() * 3) : Math.floor(random() * 5);
                    const side = cell - gap;
                    paths[tone].push(`M${x} ${y}h${side}v${side}h${-side}Z`);
                }
            const spirals = [];
            for (let i = 0; i < 60 && spirals.length < 10; i++) {
                const [x, y, r] = [between(0, w), between(0, h), between(0.03, 0.05) * size];
                if (calm(x, y, r)) continue;
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
            for (let i = 0; i < 80 && shapes.length < 12; i++) {
                const [x, y, r] = [between(-0.05, 1.05) * w, between(-0.05, 1.05) * h, between(0.08, 0.14) * size];
                if (calm(x, y, r * 0.8)) continue;
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
            for (let i = 0; i < 60 && shapes.length < 22; i++) {
                const [x, y] = [between(0, w), between(0, h)];
                if (calm(x, y, 6 * scale)) continue;
                shapes.push(<Circle key={`d${i}`} cx={x} cy={y} r={between(0.012, 0.02) * size} fill={pick(["#F6F1E7", "#F2B705", "#E8505B"])} />);
            }
            return shapes;
        }

        case "suits":
            // Spades, hearts, diamonds and clubs scattered round the table, facing every way: faint
            // enough to look like a print on the felt, and none in the middle.
            return Array.from({ length: howMany(40) }, (_, i) => {
                const suit = pick(SUITS);
                const red = suit === "♥" || suit === "♦";
                const [x, y] = [between(0, w), between(0, h)];
                if (calm(x, y)) return null;
                return (
                    <SvgText
                        key={i}
                        x={x}
                        y={y}
                        fontSize={between(12, 16) * scale}
                        fill={red ? "#FF9A9A" : "#FFFFFF"}
                        opacity={red ? 0.16 : 0.11}
                        textAnchor="middle"
                        transform={`rotate(${between(0, 360)} ${x} ${y})`}
                    >
                        {suit}
                    </SvgText>
                );
            });

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
            // Casino chips seen from above, scattered round the table: big and clear, never on top
            // of each other, and none in the middle.
            const placed: [number, number, number][] = [];
            for (let i = 0; i < 400 && placed.length < howMany(70); i++) {
                const [x, y, r] = [between(0, w), between(0, h), between(8, 11) * scale];
                if (calm(x, y, r)) continue;
                if (placed.some(([px, py, pr]) => (px - x) ** 2 + (py - y) ** 2 < (pr + r + 3 * scale) ** 2)) continue;
                placed.push([x, y, r]);
            }
            return placed.map(([x, y, r], i) => {
                const color = pick(["#E04646", "#2F6FE0", "#22A05A", "#F07F1E", "#8B3FD0", GOLD]);
                const spots = 2 * Math.PI * r * 0.82;
                return (
                    <G key={i} opacity={0.75} transform={`rotate(${between(0, 360)} ${x} ${y})`}>
                        <Circle cx={x} cy={y} r={r} fill={color} />
                        <Circle cx={x} cy={y} r={r * 0.82} fill="none" stroke="#FFFFFF" strokeWidth={r * 0.28} strokeDasharray={`${spots / 12} ${spots / 12}`} />
                        <Circle cx={x} cy={y} r={r * 0.56} fill="none" stroke="#FFFFFF" strokeWidth={r * 0.06} opacity={0.8} />
                    </G>
                );
            });
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
