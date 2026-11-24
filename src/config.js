// Every gameplay tunable lives here. The debug panel (backtick key / ?debug=1)
// edits this object live; "Copy JSON" exports your tuned values.
// Units: stage pixels (stage is 1584x1080, same space as the reference
// screenshots) and seconds.

export const STAGE = {
  W: 1584,
  H: 1080,
  PLAY_TOP: 142,
  PLAY_BOTTOM: 995,
};

export const GAME_TITLE = 'HOOPWORKS';
export const GAME_TITLE_LINES = ['HOOP', 'WORKS'];

export function defaultConfig() {
  return {
    sim: {
      hz: 120, // fixed physics rate
      maxStepsPerFrame: 15, // spiral-of-death guard
    },

    ball: {
      radius: 33, // in the hoop plane (~66px ball, rim opening ~104px)
      gravity: 2100,
      maxSpeed: 2600,
      airDrag: 0.15, // per second, proportional
      maxSubstepTravel: 0.25, // fraction of radius per substep (anti-tunnelling)
      maxLifetime: 10, // safety: a ball that somehow never leaves is removed after this
    },

    // The throw: ball leaves the camera at the cursor, arcs up while shrinking
    // with depth, and lands in the hoop plane exactly at the click point.
    flight: {
      duration: 0.62,
      startScale: 3.1,
      arcHeight: 175,
      arrivalVyFactor: 0.32, // fraction of the arc's screen-space fall speed kept on landing
      // ONE BALL AT A TIME: the next throw unlocks the instant the current ball
      // is completely out of view (dropped below the playfield, off a side, or
      // a miss that has faded away behind the machine).
      oneBallAtATime: true,
      cooldown: 0, // optional extra delay after a throw (seconds)
      maxLiveBalls: 3, // only used when oneBallAtATime is false
      boardCatchMargin: 4, // px of forgiveness around a backboard's edge
      topCatchGrace: 60, // a ball landing up to this far ABOVE a board still drops in front of it
    },

    // A shot that lands on empty background sails behind the machine.
    miss: {
      duration: 0.55,
      endScale: 0.5,
      gravity: 1100,
      darken: 0.6,
    },

    hoop: {
      boardW: 196,
      boardH: 166,
      rimOffsetY: 2, // rim line relative to board centre
      rimHalfWidth: 52,
      rimEndRadius: 4.5,
      rimRestitution: 0.48,
      rimFriction: 0.08, // tangential damping on rim contact
      entryAssist: 4, // extra px on each side for the "crossed the rim inside the opening" test
      netDepth: 74,
      netCatchDepth: 40, // a ball that LANDS up to this far below the rim, inside the net, counts
      netCentering: 900, // spring strength pulling a scored ball to the hoop centre
      netDamping: 45, // horizontal damping inside the net (~critical)
      netDrag: 2.2, // vertical slow-down inside the net
      netCarry: 0.25, // how much of a moving hoop's sideways speed the net passes to the ball
      swishTime: 0.45,
    },

    movers: {
      speedScale: 1, // global multiplier on every level's hoop speeds
    },

    scoring: {
      basketPoints: 2,
      // Bonus awarded the moment a single ball completes its Nth basket.
      // The original's panels read "Double Baskets (50 points)" and
      // "Triple Baskets (100 points)": a triple's bonus is 100 in total.
      bonuses: { 2: 50, 3: 100 },
      // 'replace':    triple pays 100 total (+50 at the 2nd, +50 more at the 3rd)
      // 'cumulative': triple pays 150 (+50, then +100)
      bonusMode: 'replace',
      labels: { 2: 'DOUBLE!', 3: 'TRIPLE!' },
    },

    game: {
      levelTime: 60, // default if a level does not set its own
      introTime: 2.4, // level preview: hoops run up to their start positions, then freeze
      levelEndTime: 3.0, // click / Space skips
      buzzerGrace: 1.6, // balls already thrown when time hits 0 may still score
      warnTime: 5, // last-seconds countdown ticks (rounds are short now)
    },

    audio: {
      volume: 0.55,
    },
  };
}

export const CONFIG = defaultConfig();
