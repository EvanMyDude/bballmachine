import { makeTrack, makeMover, moverPose } from './paths.js';

// A hoop = backboard + rim + net. Stationary hoops have a fixed centre;
// moving hoops ride a track. Geometry (board size, rim width) comes from config
// so the debug panel can tune it live.

export function buildTracks(level, cfg) {
  const tracks = {};
  for (const [id, t] of Object.entries(level.tracks || {})) {
    tracks[id] = { def: t, track: makeTrack(t.points, t.mode || 'loop') };
  }
  return tracks;
}

export function createHoops(level, cfg) {
  const tracks = buildTracks(level, cfg);
  const scale = cfg.movers.speedScale;
  const hoops = (level.hoops || []).map((h, i) => {
    const hoop = {
      id: i,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      mover: null,
      fixed: null,
      z: h.z ?? (h.track ? 100 + i : i),
      swish: 0, // seconds left in the net-swish animation
      flash: 0, // seconds left in the scored-flash
    };
    if (h.track) {
      const t = tracks[h.track];
      if (!t) throw new Error(`level ${level.id}: unknown track ${h.track}`);
      hoop.mover = makeMover(t.track, {
        speed: (h.speed ?? t.def.speed ?? 110) * scale,
        start: h.start,
        dir: h.dir ?? t.def.dir ?? 1,
        pause: t.def.pause ?? 0,
      });
    } else {
      hoop.fixed = { x: h.at[0], y: h.at[1] };
    }
    setHoopTime(hoop, 0);
    return hoop;
  });
  return { hoops, tracks };
}

export function hoopPose(hoop, t) {
  if (hoop.fixed) return { x: hoop.fixed.x, y: hoop.fixed.y, vx: 0, vy: 0 };
  return moverPose(hoop.mover, t);
}

export function setHoopTime(hoop, t) {
  const p = hoopPose(hoop, t);
  hoop.x = p.x;
  hoop.y = p.y;
  hoop.vx = p.vx;
  hoop.vy = p.vy;
}

export function rimGeometry(pose, hcfg) {
  const y = pose.y + hcfg.rimOffsetY;
  return {
    y,
    left: pose.x - hcfg.rimHalfWidth,
    right: pose.x + hcfg.rimHalfWidth,
  };
}

// Is (x, y) on this hoop's backboard (with margin)?
export function boardContains(pose, x, y, hcfg, margin = 0) {
  return (
    Math.abs(x - pose.x) <= hcfg.boardW / 2 + margin &&
    Math.abs(y - pose.y) <= hcfg.boardH / 2 + margin
  );
}
