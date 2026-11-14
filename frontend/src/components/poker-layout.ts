// Where everything goes on the poker table, so that nothing covers anything else. Each seat has
// its action label on its top edge and its bet on its bottom edge. In front of it on the felt lie
// its cards and its chips: beside the seat toward the middle for seats on the sides, and below or
// above it for seats at the top and bottom. The middle holds whose turn, the board, the timer and
// the pot. Seats sit on fixed spots for each number of players. `fitTable` draws it all as big
// as the space allows while nothing overlaps (checked by `overlaps`).

export type Rect = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };

export const SEAT_W = 80;
export const SEAT_H = 58;
/** The action label sits on a seat's top edge: this much of it above the seat. */
export const LABEL_RISE = 14;
export const LABEL_H = 18;
/** The bet sits on a seat's bottom edge: this much of it below the seat. */
export const BET_DROP = 18;
export const BET_H = 20;
/** What lies in front of a seat: its cards and chips, one above the other (beside a side seat)
 * or side by side (below or above a seat at the top or bottom). */
export const FRONT_TALL = { w: 28, h: 46 };
export const FRONT_WIDE = { w: 64, h: 26 };
/** The middle: whose turn, the board, then the timer next to the pot. */
export const BOARD_CARD = { w: 21, h: 30 };
export const BOARD_GAP = 3;
export const RING = 56;
export const MIDDLE_W = 5 * BOARD_CARD.w + 4 * BOARD_GAP;
export const MIDDLE_GAP = 3;
export const TOP_LINE_H = 16;
export const MIDDLE_H = TOP_LINE_H + MIDDLE_GAP + BOARD_CARD.h + MIDDLE_GAP + RING;
/** Room above the table for the top seats' labels, and below it for the bottom seat's bet. */
export const TOP_ROOM = LABEL_RISE;
export const BOTTOM_ROOM = BET_DROP;
/** The least space kept between any two things. */
const CLEAR = 2;

/** Each seat's spot, from your seat at the bottom going clockwise: across (0 = left edge,
 * 1 = right edge) and down (0 = top, 1 = bottom). */
const SPOTS: Record<number, [number, number][]> = {
  2: [[0.5, 1], [0.5, 0]],
  3: [[0.5, 1], [0, 0.25], [1, 0.25]],
  4: [[0.5, 1], [0, 0.5], [0.5, 0], [1, 0.5]],
  5: [[0.5, 1], [0, 0.6], [0.2, 0], [0.8, 0], [1, 0.6]],
  6: [[0.5, 1], [0, 0.7], [0, 0.25], [0.5, 0], [1, 0.25], [1, 0.7]],
  7: [[0.5, 1], [0, 0.75], [0, 0.35], [0.25, 0], [0.75, 0], [1, 0.35], [1, 0.75]],
  8: [[0.5, 1], [0, 0.9], [0, 0.6], [0, 0.3], [0.5, 0], [1, 0.3], [1, 0.6], [1, 0.9]],
  9: [[0.5, 1], [0, 0.9], [0, 0.6], [0, 0.3], [0.32, 0], [0.68, 0], [1, 0.3], [1, 0.6], [1, 0.9]],
};

export type SeatSpot = {
  /** The seat's middle. */
  at: Point;
  box: Rect;
  label: Rect;
  bet: Rect;
  /** Where its cards and chips lie, and which way round. */
  front: Rect;
  frontTall: boolean;
};

export type TableLayout = {
  middle: Point;
  middleRect: Rect;
  spots: SeatSpot[];
  /** The felt's outside edge (its rim included) and how round its corners are. */
  felt: Rect;
  feltRadius: number;
  width: number;
  height: number;
  areaHeight: number;
};

/** The felt's rim, inside its outside edge. */
export const RIM_W = 10;

function centered(c: Point, w: number, h: number): Rect {
  return { x: c.x - w / 2, y: c.y - h / 2, w, h };
}

/** Everything's place on a table `width` wide and `height` tall (below TOP_ROOM). */
export function placeAll(
  width: number,
  height: number,
  seats: number,
  bottomSeat: number,
  /** Side seats' cards and chips under the seat (narrow spaces), instead of beside it. */
  sideFrontBelow = false,
): TableLayout {
  const middle = { x: width / 2, y: TOP_ROOM + height / 2 };
  // The felt runs through the seats' middles, with rounded corners.
  const felt = {
    x: SEAT_W / 2,
    y: TOP_ROOM + SEAT_H / 2,
    w: width - SEAT_W,
    h: height - SEAT_H,
  };
  const feltRadius = Math.min(felt.w, felt.h) * 0.42;
  const spotList = SPOTS[Math.max(2, Math.min(9, seats))];
  const spots: SeatSpot[] = Array.from({ length: seats }, (_, seat) => {
    const [across, down] = spotList[(seat - bottomSeat + seats) % seats] ?? [0.5, 0.5];
    const at = {
      x: SEAT_W / 2 + across * (width - SEAT_W),
      y: TOP_ROOM + SEAT_H / 2 + down * (height - SEAT_H),
    };
    const box = centered(at, SEAT_W, SEAT_H);
    const label = { x: box.x, y: box.y - LABEL_RISE, w: SEAT_W, h: LABEL_H };
    const bet = { x: box.x, y: box.y + SEAT_H + BET_DROP - BET_H, w: SEAT_W, h: BET_H };
    const side = across === 0 || across === 1;
    let front: Rect;
    if (side && sideFrontBelow) {
      // Just inside the felt's rim, under the seat (top half) or over it (bottom half), so it
      // lies toward the middle.
      const x = across === 0 ? at.x + RIM_W + CLEAR : at.x - RIM_W - CLEAR - FRONT_WIDE.w;
      const y = down < 0.5 ? bet.y + BET_H + CLEAR : label.y - CLEAR - FRONT_WIDE.h;
      front = { x, y, w: FRONT_WIDE.w, h: FRONT_WIDE.h };
    } else if (side) {
      // Beside the seat, toward the middle.
      const x = across === 0 ? box.x + SEAT_W + CLEAR : box.x - CLEAR - FRONT_TALL.w;
      front = { x, y: at.y - FRONT_TALL.h / 2, w: FRONT_TALL.w, h: FRONT_TALL.h };
    } else if (down < 0.5) {
      // Below a seat at the top, under its bet.
      const y = bet.y + BET_H + CLEAR;
      front = { x: at.x - FRONT_WIDE.w / 2, y, w: FRONT_WIDE.w, h: FRONT_WIDE.h };
    } else {
      // Above a seat at the bottom, over its label.
      const y = label.y - CLEAR - FRONT_WIDE.h;
      front = { x: at.x - FRONT_WIDE.w / 2, y, w: FRONT_WIDE.w, h: FRONT_WIDE.h };
    }
    // Near a rounded corner it can stick out past the felt: slide it toward the middle.
    for (let step = 0; step < 40 && !onFelt(front, felt, feltRadius); step++) {
      const c = { x: front.x + front.w / 2, y: front.y + front.h / 2 };
      const length = Math.hypot(middle.x - c.x, middle.y - c.y) || 1;
      front = {
        ...front,
        x: front.x + ((middle.x - c.x) / length) * 2,
        y: front.y + ((middle.y - c.y) / length) * 2,
      };
    }
    return { at, box, label, bet, front, frontTall: side && !sideFrontBelow };
  });
  return {
    middle,
    middleRect: centered(middle, MIDDLE_W, MIDDLE_H),
    spots,
    felt,
    feltRadius,
    width,
    height,
    areaHeight: TOP_ROOM + height + BOTTOM_ROOM,
  };
}

/** Whether a rectangle lies on the felt, inside its rim. */
function onFelt(r: Rect, felt: Rect, feltRadius: number) {
  const f = {
    x: felt.x + RIM_W,
    y: felt.y + RIM_W,
    w: felt.w - 2 * RIM_W,
    h: felt.h - 2 * RIM_W,
  };
  const radius = Math.max(0, feltRadius - RIM_W);
  return [
    [r.x, r.y],
    [r.x + r.w, r.y],
    [r.x, r.y + r.h],
    [r.x + r.w, r.y + r.h],
  ].every(([x, y]) => {
    if (x < f.x || x > f.x + f.w || y < f.y || y > f.y + f.h) return false;
    // In a corner: within its rounding.
    const cx = Math.min(Math.max(x, f.x + radius), f.x + f.w - radius);
    const cy = Math.min(Math.max(y, f.y + radius), f.y + f.h - radius);
    return Math.hypot(x - cx, y - cy) <= radius;
  });
}

/** The same layout `scale` times bigger, in points on the screen. */
function scaled(layout: TableLayout, scale: number): TableLayout {
  const r = (x: Rect): Rect => ({ x: x.x * scale, y: x.y * scale, w: x.w * scale, h: x.h * scale });
  return {
    middle: { x: layout.middle.x * scale, y: layout.middle.y * scale },
    middleRect: r(layout.middleRect),
    spots: layout.spots.map((s) => ({
      ...s,
      at: { x: s.at.x * scale, y: s.at.y * scale },
      box: r(s.box),
      label: r(s.label),
      bet: r(s.bet),
      front: r(s.front),
    })),
    felt: r(layout.felt),
    feltRadius: layout.feltRadius * scale,
    width: layout.width * scale,
    height: layout.height * scale,
    areaHeight: layout.areaHeight * scale,
  };
}

function apart(a: Rect, b: Rect) {
  return (
    a.x + a.w + CLEAR <= b.x ||
    b.x + b.w + CLEAR <= a.x ||
    a.y + a.h + CLEAR <= b.y ||
    b.y + b.h + CLEAR <= a.y
  );
}

/** Whether anything covers anything else, or leaves the table's area. A seat's label and bet
 * sit on its edges on purpose. */
export function overlaps(layout: TableLayout, width: number): boolean {
  // The cards and chips in front of each seat, and the middle, lie on the felt.
  const { felt, feltRadius } = layout;
  if (!onFelt(layout.middleRect, felt, feltRadius)) return true;
  if (layout.spots.some((s) => !onFelt(s.front, felt, feltRadius))) return true;
  const items: { seat: number; part: string; r: Rect }[] = [
    { seat: -1, part: "middle", r: layout.middleRect },
  ];
  layout.spots.forEach((s, seat) => {
    for (const part of ["box", "label", "bet", "front"] as const) {
      items.push({ seat, part, r: s[part] });
    }
  });
  for (const [i, a] of items.entries()) {
    const r = a.r;
    if (r.x < 0 || r.y < 0 || r.x + r.w > width || r.y + r.h > layout.areaHeight) return true;
    for (const b of items.slice(i + 1)) {
      const onEdge = a.seat === b.seat && a.part === "box" && ["label", "bet"].includes(b.part);
      if (!onEdge && !apart(a.r, b.r)) return true;
    }
  }
  return false;
}

/** How the table is drawn in a box: `layout` in points on the screen, everything `scale` times
 * its normal size. */
export type FittedTable = { layout: TableLayout; scale: number };

const BIGGEST = 1.7;
const SMALLEST = 0.5;
/** Never taller than this times its width, so it still looks like a table. */
const TALLEST = 1.5;

/** The biggest the table can be drawn in a box with nothing overlapping: tries sizes from the
 * biggest down, each with side seats' things beside them and then under them. */
export function fitTable(
  boxWidth: number,
  boxHeight: number,
  seats: number,
  bottomSeat: number,
): FittedTable {
  let last: FittedTable | null = null;
  for (let scale = BIGGEST; scale >= SMALLEST; scale -= 0.02) {
    const width = boxWidth / scale;
    const height = Math.min(boxHeight / scale - TOP_ROOM - BOTTOM_ROOM, width * TALLEST);
    if (height < SEAT_H * 2) continue;
    for (const below of [false, true]) {
      const layout = placeAll(width, height, seats, bottomSeat, below);
      last = { layout: scaled(layout, scale), scale };
      if (!overlaps(layout, width)) return last;
    }
  }
  return last ?? { layout: placeAll(boxWidth, boxWidth, seats, bottomSeat), scale: 1 };
}
