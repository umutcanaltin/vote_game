import React, { useEffect, useRef, useState } from "react";
import Matter from "matter-js";

const {
  Engine, Render, Runner, World, Bodies, Body, Events,
  Mouse, MouseConstraint, Query, Vector
} = Matter;

// ---- Genres (your list) ----
const GENRES = [
  { key: "house", label: "House", color: "#ffb347" },
  { key: "trance", label: "Trance", color: "#3ddcff" },
  { key: "hard_techno", label: "Hard Techno", color: "#ff477e" },
  { key: "hard_house", label: "Hard House", color: "#ff7a3d" },
  { key: "industrial_hard_techno", label: "Industrial Hard Techno", color: "#9aa0ff" },
  { key: "hardstyle", label: "Hardstyle", color: "#ffd166" },
  { key: "hardcore", label: "Hardcore", color: "#ff006e" },
  { key: "drum_bass", label: "Drum & Bass", color: "#00d4a6" },
  { key: "afro", label: "Afro", color: "#ff5e00" },
  { key: "hard_bounce", label: "Hard Bounce", color: "#7cfc00" },
  { key: "shranz", label: "Shranz", color: "#b084ff" },
  { key: "pop", label: "Pop", color: "#ff66cc" },
  { key: "groove", label: "Groove", color: "#34d399" },
  { key: "driving_techno", label: "Driving Techno", color: "#00bcd4" },
  { key: "turku", label: "Turku", color: "#a3e635" },
];

const LS_KEY = "matter_bubbles_votes_v5";

// speeds (zippy)
const INIT_SPEED_MIN = 7;
const INIT_SPEED_MAX = 12;
const KICK_BASE = 14;
const KICK_VARIANCE = 9;

// growth curve (bigger per click)
const BASE_RADIUS = 30;
const SQRT_COEFF  = 12;   // sqrt growth
const EARLY_BOOST = 1.25; // extra linear kick for first ~12 votes
function radiusForVotes(v = 0) {
  const n = Math.max(0, v);
  return BASE_RADIUS + SQRT_COEFF * Math.sqrt(n) + EARLY_BOOST * Math.min(n, 12);
}

export default function Bubbles() {
  const containerRef = useRef(null);

  // physics refs so buttons/handlers can touch the world
  const engineRef = useRef(null);
  const bodyMapRef = useRef({}); // key -> Matter body

  // votes (persisted). We don't draw counts on bubbles anymore.
  const [votes, setVotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}") || {}; }
    catch { return {}; }
  });
  const votesRef = useRef(votes);
  useEffect(() => {
    votesRef.current = votes;
    localStorage.setItem(LS_KEY, JSON.stringify(votes));
  }, [votes]);

  // Export CSV and RESET votes (shrink bubbles immediately)
  function exportCSV() {
    // CSV
    const rows = [
      ["genre_key", "genre_label", "votes"],
      ...GENRES.map(g => [g.key, g.label, String(votesRef.current[g.key] || 0)]),
    ];
    const csv = rows
      .map(r => r
        .map(cell => /[",\n\r]/.test(cell) ? `"${String(cell).replace(/"/g, '""')}"` : cell)
        .join(","))
      .join("\r\n") + "\r\n";

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    a.href = url;
    a.download = `genre_votes_${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);

    // RESET votes
    const zeroed = Object.fromEntries(GENRES.map(g => [g.key, 0]));
    votesRef.current = zeroed;
    localStorage.setItem(LS_KEY, JSON.stringify(zeroed));
    setVotes(zeroed);

    // Shrink bubbles back to base size immediately
    const engine = engineRef.current;
    const map = bodyMapRef.current;
    if (engine && map) {
      for (const key of Object.keys(map)) {
        const old = map[key];
        if (!old) continue;
        const newR = radiusForVotes(0);
        const newBody = Bodies.circle(old.position.x, old.position.y, newR, {
          restitution: 0.95,
          friction: 0.0005,
          frictionAir: 0.014,
          render: { fillStyle: GENRES.find(g => g.key === key)?.color || "#888" },
          label: key,
        });
        Body.setVelocity(newBody, old.velocity);
        World.remove(engine.world, old);
        World.add(engine.world, newBody);
        map[key] = newBody;
      }
    }
  }

  useEffect(() => {
    const el = containerRef.current;
    const width = el.clientWidth || 960;
    const height = 560;

    // engine + renderer
    const engine = Engine.create({ gravity: { x: 0, y: 0 } });
    engineRef.current = engine;

    const render = Render.create({
      element: el,
      engine,
      options: {
        width,
        height,
        background: "#0b1220",
        wireframes: false,
        pixelRatio: window.devicePixelRatio || 1,
      },
    });
    Render.run(render);
    const runner = Runner.create();
    Runner.run(runner, engine);

    // walls
    const thickness = 60;
    const walls = [
      Bodies.rectangle(width / 2, -thickness / 2, width, thickness, { isStatic: true }),
      Bodies.rectangle(width / 2, height + thickness / 2, width, thickness, { isStatic: true }),
      Bodies.rectangle(-thickness / 2, height / 2, thickness, height, { isStatic: true }),
      Bodies.rectangle(width + thickness / 2, height / 2, thickness, height, { isStatic: true }),
    ];
    World.add(engine.world, walls);

    // spawn around a ring so the start layout is clean
    const cx = width / 2, cy = height / 2;
    const ringR = Math.min(width, height) * 0.33;

    const bodyMap = {};
    const makeBody = (g, i) => {
      const count = votesRef.current[g.key] || 0;
      const radius = radiusForVotes(count);
      const ang = (i / GENRES.length) * Math.PI * 2;
      const x = cx + Math.cos(ang) * ringR * 0.9;
      const y = cy + Math.sin(ang) * ringR * 0.9;
      const b = Bodies.circle(x, y, radius, {
        restitution: 0.95,
        friction: 0.0005,
        frictionAir: 0.014,
        render: { fillStyle: g.color },
        label: g.key,
      });
      // random initial velocity
      const a0 = Math.random() * Math.PI * 2;
      const sp = INIT_SPEED_MIN + Math.random() * (INIT_SPEED_MAX - INIT_SPEED_MIN);
      Body.setVelocity(b, { x: Math.cos(a0) * sp, y: Math.sin(a0) * sp });

      bodyMap[g.key] = b;
      return b;
    };
    World.add(engine.world, GENRES.map(makeBody));
    bodyMapRef.current = bodyMap;

    // helpers
    const nearestOther = (b) => {
      let best = null, bestD2 = Infinity;
      for (const o of Object.values(bodyMap)) {
        if (o === b) continue;
        const dx = o.position.x - b.position.x;
        const dy = o.position.y - b.position.y;
        const d2 = dx*dx + dy*dy;
        if (d2 < bestD2) { bestD2 = d2; best = o; }
      }
      return best;
    };

    const kickTowardNearest = (b) => {
      const target = nearestOther(b);
      let dir;
      if (target) {
        const v = { x: target.position.x - b.position.x, y: target.position.y - b.position.y };
        dir = Vector.normalise(v);
        const jitter = (Math.random() - 0.5) * (Math.PI / 5); // ±36°
        const c = Math.cos(jitter), s = Math.sin(jitter);
        dir = { x: dir.x * c - dir.y * s, y: dir.x * s + dir.y * c };
      } else {
        const a = Math.random() * Math.PI * 2;
        dir = { x: Math.cos(a), y: Math.sin(a) };
      }
      const r = b.circleRadius || BASE_RADIUS;
      const sizeScale = Math.max(0.65, 52 / (r + 1));
      const speed = (KICK_BASE + Math.random() * KICK_VARIANCE) * sizeScale;
      Body.setVelocity(b, {
        x: b.velocity.x + dir.x * speed,
        y: b.velocity.y + dir.y * speed,
      });
    };

    // mouse handling
    const mouse = Mouse.create(render.canvas);
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: 0.2, render: { visible: false } },
    });
    World.add(engine.world, mouseConstraint);

    Events.on(mouseConstraint, "mousedown", (e) => {
      const pos = e.mouse.position;
      const hits = Query.point(Object.values(bodyMap), pos);
      if (!hits.length) return;
      const b = hits[0];
      const key = b.label;

      // 1) movement
      kickTowardNearest(b);

      // 2) votes (persist)
      const next = { ...votesRef.current, [key]: (votesRef.current[key] || 0) + 1 };
      votesRef.current = next;
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      setVotes(next);

      // 3) resize: replace body with larger one, carry velocity
      const newRadius = radiusForVotes(next[key]);
      const newBody = Bodies.circle(b.position.x, b.position.y, newRadius, {
        restitution: 0.95,
        friction: 0.0005,
        frictionAir: 0.014,
        render: { fillStyle: GENRES.find(g => g.key === key)?.color || "#888" },
        label: key,
      });
      Body.setVelocity(newBody, b.velocity);
      World.remove(engine.world, b);
      World.add(engine.world, newBody);
      bodyMap[key] = newBody;
      bodyMapRef.current = bodyMap;
    });

    // anti-stick nudge
    Events.on(engine, "afterUpdate", () => {
      for (const b of Object.values(bodyMap)) {
        const v2 = b.velocity.x*b.velocity.x + b.velocity.y*b.velocity.y;
        if (v2 < 0.0005) {
          const a = Math.random() * Math.PI * 2;
          Body.setVelocity(b, { x: Math.cos(a)*1.8, y: Math.sin(a)*1.8 });
        }
      }
    });

    // ---- Text fitting (multi-line, always inside) ----
    function wrapIntoLines(ctx, text, maxWidth) {
      // handles long single words by hard-breaking
      const pieces = text.split(/\s+/).flatMap(word => {
        let chunk = "";
        const out = [];
        for (const ch of word) {
          const test = chunk + ch;
          if (ctx.measureText(test).width > maxWidth && chunk.length > 0) {
            out.push(chunk);
            chunk = ch;
          } else {
            chunk = test;
          }
        }
        if (chunk) out.push(chunk);
        return out;
      });

      const lines = [];
      let cur = "";
      for (const w of pieces) {
        const test = cur ? cur + " " + w : w;
        if (ctx.measureText(test).width <= maxWidth) {
          cur = test;
        } else {
          if (cur) lines.push(cur);
          cur = w;
        }
      }
      if (cur) lines.push(cur);
      return lines;
    }

    // Draw only the genre titles, always inside the circle
    Events.on(render, "afterRender", () => {
      const ctx = render.context;
      ctx.save();
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = 6;
      const fontFamily = "Inter, system-ui, sans-serif";

      for (const key of Object.keys(bodyMap)) {
        const b = bodyMap[key];
        const genre = GENRES.find(g => g.key === key);
        const r = b.circleRadius || BASE_RADIUS;

        // keep text comfortably smaller than bubble
        const maxWidth  = r * 1.6; // ~80% diameter
        const maxHeight = r * 1.3; // ~65% diameter
        const maxLines  = 3;

        let chosenLines = [];
        let chosenFont = Math.floor(r * 0.25); // cap ~25% of radius

        // try shrinking font until it fits both width & height
        for (let font = chosenFont; font >= 8; font--) {
          ctx.font = `bold ${font}px ${fontFamily}`;

          const lines = wrapIntoLines(ctx, genre?.label ?? key, maxWidth);
          const lineHeight = font + 2;
          const blockHeight = lines.length * lineHeight;

          if (lines.length <= maxLines && blockHeight <= maxHeight) {
            chosenFont = font;
            chosenLines = lines;
            break;
          }
        }

        // draw lines vertically centered
        ctx.fillStyle = "#0b1220";
        const lineHeight = chosenFont + 2;
        const startY = b.position.y - ((chosenLines.length - 1) * lineHeight) / 2;
        chosenLines.forEach((line, i) => {
          ctx.font = `bold ${chosenFont}px ${fontFamily}`;
          ctx.fillText(line, b.position.x, startY + i * lineHeight);
        });
      }

      ctx.restore();
    });

    // cleanup
    return () => {
      Render.stop(render);
      Runner.stop(runner);
      World.clear(engine.world, false);
      Engine.clear(engine);
      render.canvas.remove();
      render.textures = {};
    };
  }, []);

  return (
    <div className="w-full relative">
      <div
        ref={containerRef}
        style={{ width: "100%", height: 560, borderRadius: 16, overflow: "hidden" }}
        className="border border-white/10"
      />

      <div className="flex justify-end gap-2 mt-2">
        <button
          onClick={exportCSV}
          className="px-3 py-1.5 rounded-md border border-white/20 text-sm text-slate-100 hover:bg-white/10"
        >
          Export CSV & Reset
        </button>
      </div>

      {/* bottom-center "Powered by" (text first, then PNG) */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
        <div className="text-xs uppercase tracking-wide text-slate-200/85 mb-1">
          Powered by
        </div>
        <img
          src="/poweredby.png"  // place your PNG in /public/poweredby.png
          alt="Powered by"
          className="w-[min(200px,40vw)] drop-shadow-lg"
        />
      </div>
    </div>
  );
}
