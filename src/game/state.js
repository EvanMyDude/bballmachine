import { createWorld, stepWorld, drainEvents, shoot, liveBallCount } from './world.js';
import { neededFor } from './scoring.js';

// Game flow (pure; no DOM). Phases:
//   title -> intro -> playing -> buzzer -> levelEnd -> intro (next level) ...
//                                   \-> gameOver (retry level / start over)
//                                   \-> victory  (after the last level)
// As in the original, a level runs its FULL timer even after NEEDED hits 0.
// You pass if NEEDED is 0 when time runs out.

// Clickable buttons on the end screens (stage coords). Shared with the renderer.
export const UI = {
  retry: { x: 562, y: 640, w: 220, h: 64, label: 'TRY AGAIN' },
  restart: { x: 802, y: 640, w: 220, h: 64, label: 'START OVER' },
  again: { x: 662, y: 680, w: 260, h: 64, label: 'PLAY AGAIN' },
};

const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export function createGame(levels, cfg, { best = 0, roundBest = {} } = {}) {
  return {
    levels,
    cfg,
    phase: 'title',
    phaseT: 0,
    levelIndex: 0,
    score: 0,
    levelStartScore: 0,
    target: 0,
    timeLeft: 0,
    levelTime: 0,
    best,
    newBest: false,
    roundBest: { ...roundBest }, // best points scored in each round, by level id
    newRoundBest: false,
    reached: false, // NEEDED hit 0 this round
    lastRoundPoints: 0,
    world: createWorld(levels[0], cfg), // title screen shows level 1 running
    inputQueue: [],
    events: [], // drained each frame by renderer/audio
    lastTick: null,
  };
}

export function levelPoints(game) {
  return game.score - game.levelStartScore;
}

export function needed(game) {
  return neededFor(game.target, levelPoints(game));
}

export function startLevel(game, index) {
  const level = game.levels[index];
  game.levelIndex = index;
  game.levelStartScore = game.score;
  game.target = level.target;
  game.levelTime = level.time ?? game.cfg.game.levelTime;
  game.timeLeft = game.levelTime;
  game.world = createWorld(level, game.cfg);
  game.phase = 'intro';
  game.phaseT = 0;
  game.lastTick = null;
  game.reached = false;
  game.newRoundBest = false;
  game.events.push({ type: 'levelStart', level: level.id });
}

export function newGame(game) {
  game.score = 0;
  game.newBest = false;
  startLevel(game, 0);
}

export function retryLevel(game) {
  game.score = game.levelStartScore;
  game.newBest = false;
  startLevel(game, game.levelIndex);
}

function setPhase(game, phase) {
  game.phase = phase;
  game.phaseT = 0;
}

// Record this round's points against the player's best for the round.
function closeRound(game) {
  const id = game.levels[game.levelIndex].id;
  const pts = levelPoints(game);
  game.lastRoundPoints = pts;
  game.newRoundBest = pts > (game.roundBest[id] || 0);
  if (game.newRoundBest) game.roundBest[id] = pts;
}

function finishGame(game, phase) {
  closeRound(game);
  if (game.score > game.best) {
    game.best = game.score;
    game.newBest = true;
  }
  setPhase(game, phase);
  game.events.push({ type: phase });
}

// Space / Enter / R on a menu screen: the obvious "keep going" action.
export function handleKey(game) {
  switch (game.phase) {
    case 'title':
    case 'victory':
      if (game.phase === 'title' || game.phaseT > 0.6) newGame(game);
      break;
    case 'intro':
      setPhase(game, 'playing');
      break;
    case 'levelEnd':
      if (game.phaseT > 0.4) startLevel(game, game.levelIndex + 1);
      break;
    case 'gameOver':
      if (game.phaseT > 0.4) retryLevel(game);
      break;
    default:
      break;
  }
}

export function handleClick(game, x, y) {
  switch (game.phase) {
    case 'title':
      newGame(game);
      break;
    case 'intro':
      setPhase(game, 'playing');
      break;
    case 'playing':
      shoot(game.world, x, y);
      break;
    case 'levelEnd':
      if (game.phaseT > 0.4) startLevel(game, game.levelIndex + 1);
      break;
    case 'gameOver':
      if (game.phaseT < 0.4) break;
      if (inRect(UI.restart, x, y)) newGame(game);
      else retryLevel(game);
      break;
    case 'victory':
      if (game.phaseT > 0.6) newGame(game);
      break;
    default:
      break;
  }
}

function collectWorldEvents(game) {
  for (const e of drainEvents(game.world)) {
    const live = game.phase === 'playing' || game.phase === 'buzzer';
    if (e.type === 'basket' && live) game.score += e.points + e.bonus;
    game.events.push(e);
    // the moment NEEDED hits zero: celebrate (the round keeps running)
    if (e.type === 'basket' && live && !game.reached && needed(game) === 0) {
      game.reached = true;
      game.events.push({ type: 'targetReached', buzzer: game.phase === 'buzzer', timeLeft: game.timeLeft });
    }
  }
}

export function update(game, dt) {
  const queued = game.inputQueue;
  game.inputQueue = [];
  for (const inp of queued) {
    if (inp.type === 'click') handleClick(game, inp.x, inp.y);
    else if (inp.type === 'key') handleKey(game);
  }

  const g = game.cfg.game;
  game.phaseT += dt;

  switch (game.phase) {
    case 'title':
    case 'intro':
      stepWorld(game.world, dt);
      collectWorldEvents(game);
      if (game.phase === 'intro' && game.phaseT >= g.introTime) setPhase(game, 'playing');
      break;

    case 'playing': {
      game.timeLeft = Math.max(0, game.timeLeft - dt);
      stepWorld(game.world, dt);
      collectWorldEvents(game);
      const sec = Math.ceil(game.timeLeft);
      if (game.timeLeft > 0 && sec <= g.warnTime && sec !== game.lastTick) {
        game.lastTick = sec;
        game.events.push({ type: 'tick', seconds: sec });
      }
      if (game.timeLeft <= 0) {
        setPhase(game, 'buzzer');
        game.events.push({ type: 'timeUp' });
      }
      break;
    }

    case 'buzzer':
      // shots already in the air may still count, briefly
      stepWorld(game.world, dt);
      collectWorldEvents(game);
      if (liveBallCount(game.world) === 0 || game.phaseT >= g.buzzerGrace) {
        if (needed(game) > 0) finishGame(game, 'gameOver');
        else if (game.levelIndex >= game.levels.length - 1) finishGame(game, 'victory');
        else {
          closeRound(game);
          setPhase(game, 'levelEnd');
          game.events.push({ type: 'levelComplete', level: game.levelIndex + 1 });
        }
      }
      break;

    case 'levelEnd':
      stepWorld(game.world, dt);
      collectWorldEvents(game);
      if (game.phaseT >= g.levelEndTime) startLevel(game, game.levelIndex + 1);
      break;

    default:
      // gameOver / victory: machine keeps running in the background
      stepWorld(game.world, dt);
      collectWorldEvents(game);
      break;
  }
}

export function drainGameEvents(game) {
  const ev = game.events;
  game.events = [];
  return ev;
}
