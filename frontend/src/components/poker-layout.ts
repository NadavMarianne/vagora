// Where everything goes on the poker table, so that nothing covers anything else. Each seat has
// its action label on its top edge and its bet on its bottom edge. In front of it on the felt lie
// its cards and its chips: beside the seat toward the middle for seats on the sides, and below or
// above it for seats at the top and bottom. The middle holds whose turn, the board, the timer and
// the pot. Seats sit on fixed spots for each number of players, and the table's height is the
// first one, from what fits the screen, where nothing overlaps (checked by `overlaps`).

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
  height: number;
  areaHeight: number;
};

function centered(c: Point, w: number, h: number): Rect {
  return { x: c.x - w / 2, y: c.y - h / 2, w, h };
}

/** Everything's place on a table `width` wide and `height` tall (below TOP_ROOM). */
export function placeAll(
  width: number,
  height: number,
  seats: number,
  bottomSeat: number,
): TableLayout {
  const middle = { x: width / 2, y: TOP_ROOM + height / 2 };
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
    if (side) {
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
    return { at, box, label, bet, front, frontTall: side };
  });
  return {
    middle,
    middleRect: centered(middle, MIDDLE_W, MIDDLE_H),
    spots,
    height,
    areaHeight: TOP_ROOM + height + BOTTOM_ROOM,
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

/** The table for a width and a screen: about as tall as fits the screen with the game around it
 * (a little taller than wide, like a real table), then taller if needed until nothing overlaps. */
export function tableLayout(
  width: number,
  screenHeight: number,
  seats: number,
  bottomSeat: number,
): TableLayout {
  const wanted = Math.round(Math.max(width, Math.min(width * 1.3, screenHeight * 0.55 - TOP_ROOM)));
  let layout = placeAll(width, wanted, seats, bottomSeat);
  for (let height = wanted; height <= wanted + 600 && overlaps(layout, width); height += 4) {
    layout = placeAll(width, height, seats, bottomSeat);
  }
  return layout;
}
