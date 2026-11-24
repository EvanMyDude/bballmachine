// The eight machines, measured from the reference screenshots.
// Coordinates are stage pixels (1584x1080); hoop positions are BOARD CENTRES.
//
//  rails  : pipes that get drawn (polyline; closed: true for loops)
//  stops  : striped bumpers; orient 'h' caps a vertical pipe, 'v' a horizontal one
//  tracks : paths hoop centres follow. 'pingpong' tracks are shortened so the
//           board stops against its bumper. speed is px/s, dir +1 follows point order.
//  hoops  : { at:[x,y] } stationary, or { track, start:[x,y], dir? } moving
//  target : points NEEDED this level; time : seconds
//
// Balance (see scripts/balance.mjs): rounds are short and the targets are
// set so you finish near the buzzer. A skilled player typically clears in
// the last fifth of the clock, even perfect play needs most of it, and a
// first-time player usually needs a couple of tries. Round 2's target is all
// possible right-column triples in 35 s (11 x 106 = 1166) plus one left
// moving-hoop triple (106), or two doubles instead.
// (The original's own targets were far lower: 150 / 400 / 100 / 50...)
// Speeds and directions are not recoverable from stills. They are tuned by
// feel and ramp up level by level.

const BOARD_HALF_H = 83;
const STOP_CLEAR = 15; // half thickness of a bumper

export const LEVELS = [
  {
    id: 1,
    target: 500,
    time: 30,
    background: 'fire',
    panel: { lines: ['Go for', 'Double', 'Baskets!'], sub: '(50 points)' },
    rails: [{ points: [[292, 348], [292, 910], [492, 910], [492, 348]] }],
    stops: [
      { x: 292, y: 348, orient: 'h' },
      { x: 492, y: 348, orient: 'h' },
    ],
    tracks: {
      U: {
        mode: 'pingpong',
        speed: 160,
        pause: 0.2,
        points: [[292, 348 + STOP_CLEAR + BOARD_HALF_H], [292, 910], [492, 910], [492, 348 + STOP_CLEAR + BOARD_HALF_H]],
      },
    },
    hoops: [
      { at: [292, 228] },
      { at: [492, 228] },
      { track: 'U', start: [292, 485], dir: 1 },
    ],
  },

  {
    id: 2,
    target: 1270,
    time: 35,
    background: 'bluesmoke',
    panel: { lines: ['Go for', 'Triple', 'Baskets!'], sub: '(100 points)' },
    rails: [{ points: [[55, 400], [690, 400], [690, 790]] }],
    stops: [
      { x: 55, y: 400, orient: 'v' },
      { x: 690, y: 790, orient: 'h' },
    ],
    tracks: {
      L: {
        mode: 'pingpong',
        speed: 165,
        pause: 0.2,
        points: [[55 + STOP_CLEAR + 98, 400], [690, 400], [690, 790 - STOP_CLEAR - BOARD_HALF_H]],
      },
    },
    hoops: [
      { at: [690, 228] },
      { at: [292, 572] },
      { at: [292, 742] },
      { at: [690, 908] },
      { track: 'L', start: [507, 400], dir: 1 },
    ],
  },

  {
    id: 3,
    target: 300,
    time: 25,
    background: 'planks',
    rails: [
      {
        closed: true,
        points: [[490, 230], [1090, 230], [1090, 745], [690, 745], [690, 910], [295, 910], [295, 400], [490, 400]],
      },
    ],
    stops: [],
    tracks: {
      A: {
        mode: 'loop',
        speed: 135,
        points: [[490, 230], [1090, 230], [1090, 745], [690, 745], [690, 910], [295, 910], [295, 400], [490, 400]],
      },
    },
    hoops: [
      { at: [492, 572] },
      { at: [1090, 910] },
      { track: 'A', start: [302, 400] },
      { track: 'A', start: [907, 745] },
    ],
  },

  {
    id: 4,
    target: 575,
    time: 25,
    background: 'straw',
    rails: [
      {
        closed: true,
        points: [[295, 400], [690, 400], [690, 740], [890, 740], [890, 400], [1290, 400], [1290, 910], [295, 910]],
      },
    ],
    stops: [],
    tracks: {
      A: {
        mode: 'loop',
        speed: 140,
        points: [[295, 400], [690, 400], [690, 740], [890, 740], [890, 400], [1290, 400], [1290, 910], [295, 910]],
      },
    },
    hoops: [
      { at: [292, 228] },
      { at: [690, 228] },
      { at: [892, 228] },
      { at: [1287, 228] },
      { track: 'A', start: [692, 595] },
      { track: 'A', start: [292, 715] },
      { track: 'A', start: [1212, 910] },
    ],
  },

  {
    id: 5,
    target: 400,
    time: 25,
    background: 'sky',
    rails: [
      {
        closed: true,
        points: [[95, 230], [495, 230], [495, 565], [890, 565], [890, 230], [1490, 230], [1490, 910], [95, 910]],
      },
    ],
    stops: [],
    tracks: {
      A: {
        mode: 'loop',
        speed: 145,
        points: [[95, 230], [495, 230], [495, 565], [890, 565], [890, 230], [1490, 230], [1490, 910], [95, 910]],
      },
    },
    hoops: [
      { at: [492, 740] },
      { at: [890, 740] },
      { track: 'A', start: [492, 545] },
      { track: 'A', start: [1237, 230] },
      { track: 'A', start: [1490, 740] },
      { track: 'A', start: [862, 910] },
      { track: 'A', start: [172, 910] },
    ],
  },

  {
    id: 6,
    target: 525,
    time: 25,
    background: 'brick',
    rails: [
      { points: [[690, 790], [690, 400], [495, 400], [495, 570], [95, 570], [95, 910], [890, 910]] },
      { closed: true, points: [[890, 910], [890, 400], [1090, 400], [1090, 570], [1490, 570], [1490, 910]] },
    ],
    stops: [{ x: 690, y: 790, orient: 'h' }],
    tracks: {
      A: {
        mode: 'pingpong',
        speed: 165,
        pause: 0.2,
        points: [[690, 790 - STOP_CLEAR - BOARD_HALF_H], [690, 400], [495, 400], [495, 570], [95, 570], [95, 910], [690, 910]],
      },
      B: {
        mode: 'loop',
        speed: 150,
        points: [[890, 910], [890, 400], [1090, 400], [1090, 570], [1490, 570], [1490, 910]],
      },
    },
    hoops: [
      { at: [692, 228] },
      { at: [892, 228] },
      { at: [492, 740] },
      { at: [1087, 740] },
      { track: 'A', start: [495, 452], dir: 1 },
      { track: 'B', start: [890, 750] },
      { track: 'B', start: [1127, 910] },
    ],
  },

  {
    id: 7,
    target: 525,
    time: 20,
    background: 'beans',
    rails: [
      { points: [[295, 345], [295, 910]] },
      { points: [[695, 345], [695, 910]] },
      { points: [[1290, 345], [1290, 910]] },
      { closed: true, points: [[90, 740], [1500, 740], [1500, 910], [90, 910]] },
    ],
    stops: [
      { x: 295, y: 345, orient: 'h' },
      { x: 695, y: 345, orient: 'h' },
      { x: 1290, y: 345, orient: 'h' },
    ],
    tracks: {
      L: { mode: 'pingpong', speed: 175, pause: 0.25, points: [[295, 345 + STOP_CLEAR + BOARD_HALF_H], [295, 910]] },
      M: { mode: 'pingpong', speed: 175, pause: 0.25, points: [[695, 345 + STOP_CLEAR + BOARD_HALF_H], [695, 910]] },
      R: { mode: 'pingpong', speed: 175, pause: 0.25, points: [[1290, 345 + STOP_CLEAR + BOARD_HALF_H], [1290, 910]] },
    },
    hoops: [
      { at: [295, 228] },
      { at: [695, 228] },
      { at: [1290, 228] },
      { track: 'L', start: [295, 910], dir: -1 },
      { track: 'M', start: [695, 690], dir: 1 },
      { track: 'R', start: [1290, 515], dir: -1 },
    ],
  },

  {
    id: 8,
    target: 750,
    time: 30,
    background: 'grunge',
    rails: [
      { closed: true, points: [[290, 230], [695, 230], [695, 570], [290, 570]] },
      { closed: true, points: [[490, 570], [890, 570], [890, 910], [490, 910]] },
      { closed: true, points: [[890, 400], [1290, 400], [1290, 745], [890, 745]] },
      { points: [[850, 230], [1325, 230]] },
      { points: [[90, 175], [90, 910], [330, 910]] },
      { points: [[1480, 175], [1480, 910], [1050, 910]] },
    ],
    stops: [
      { x: 90, y: 175, orient: 'h' },
      { x: 1480, y: 175, orient: 'h' },
      { x: 850, y: 230, orient: 'v' },
      { x: 1325, y: 230, orient: 'v' },
      { x: 330, y: 910, orient: 'v' },
      { x: 1050, y: 910, orient: 'v' },
    ],
    tracks: {
      TOP: { mode: 'pingpong', speed: 185, pause: 0.25, points: [[850 + STOP_CLEAR + 98, 230], [1325 - STOP_CLEAR - 98, 230]] },
      LOW: { mode: 'loop', speed: 155, points: [[490, 570], [890, 570], [890, 910], [490, 910]] },
    },
    hoops: [
      { at: [492, 400] },
      { at: [687, 742] },
      { at: [1087, 572] },
      { track: 'TOP', start: [1097, 230] },
      { track: 'LOW', start: [742, 570] },
      { track: 'LOW', start: [662, 910] },
    ],
  },
];
