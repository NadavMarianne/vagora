// Where everything goes on the poker table. A player's things stay on their seat, so nothing can
// cover anything else: the action label on the seat's top edge, the bet (chips and amount) on its
// bottom edge, and the dealer button inside it, by the name. Seats sit on fixed spots for each
// number of players, round the middle (the round and whose turn, the board, the timer and the
// pot). A check (run by hand while building) tried every table size on phones from 360 points
// wide and found no overlaps.

export type Rect = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };

export const SEAT_W = 80;
export const SEAT_H = 58;
/** The action label sits on a seat's top edge: this much of it above the seat. */
export const LABEL_RISE = 12;
export const LABEL_H = 18;
/** The bet sits on a seat's bottom edge: this much of it below the seat. */
export const BET_DROP = 14;
export const BET_H = 20;
/** The middle: the round and whose turn, the board, then the timer next to the pot. */
export const BOARD_CARD = { w: 26, h: 37 };
export const RING = 70;
export const MIDDLE_W = 150;
export const MIDDLE_GAP = 4;
export const MIDDLE_H = 18 + MIDDLE_GAP + BOARD_CARD.h + MIDDLE_GAP + RING;
/** Room above the table for the top seats' labels, and below it for the bottom seat's bet. */
export const TOP_ROOM = LABEL_RISE;
export const BOTTOM_ROOM = BET_DROP;

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
};

function centered(c: Point, w: number, h: number): Rect {
  return { x: c.x - w / 2, y: c.y - h / 2, w, h };
}

/** The table is `width` wide and `height` tall, below TOP_ROOM. */
export function tableLayout(width: number, height: number, seats: number, bottomSeat: number) {
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
    return { at, box, label, bet };
  });
  return {
    middle,
    middleRect: centered(middle, MIDDLE_W, MIDDLE_H),
    spots,
    areaHeight: TOP_ROOM + height + BOTTOM_ROOM,
  };
}

/** The least space kept between two seats' things (labels, boxes, bets). */
const CLEAR = 2;

/** The table's height for its width and the screen: a little taller than wide, like a real table,
 * but not much more than a third of the screen, so the whole game fits without scrolling. Never
 * less than its width, or than the seats need to stay apart (a seat with its label and bet is
 * taller than it is wide). */
export function tableHeight(width: number, screenHeight: number, seats: number) {
  const wanted = Math.min(width * 1.25, screenHeight * 0.45 - TOP_ROOM);
  return Math.ceil(Math.max(width, wanted, leastHeight(width, seats)));
}

/** The least height that keeps seats apart: two seats that are side by side or overlap across
 * need to be a whole seat (with its label and bet) apart up and down. */
function leastHeight(width: number, seats: number) {
  const list = SPOTS[Math.max(2, Math.min(9, seats))];
  const tall = LABEL_RISE + SEAT_H + BET_DROP + CLEAR;
  let least = 0;
  for (const [i, a] of list.entries()) {
    for (const b of list.slice(i + 1)) {
      const across = Math.abs(a[0] - b[0]) * (width - SEAT_W);
      const down = Math.abs(a[1] - b[1]);
      if (across < SEAT_W + CLEAR && down > 0) least = Math.max(least, SEAT_H + tall / down);
    }
  }
  return least;
}
