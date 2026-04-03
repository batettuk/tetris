"use client";
import { useEffect, useRef, useState } from "react";

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const DAS = 120;
const ARR = 30;
const LOCK_DELAY = 500;

const SHAPES = [
  { name: "I", shape: [[1, 1, 1, 1]], color: "#00f0f0" },
  {
    name: "O",
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: "#f0f000",
  },
  {
    name: "T",
    shape: [
      [0, 1, 0],
      [1, 1, 1],
    ],
    color: "#a000f0",
  },
  {
    name: "L",
    shape: [
      [1, 0, 0],
      [1, 1, 1],
    ],
    color: "#f0a000",
  },
  {
    name: "J",
    shape: [
      [0, 0, 1],
      [1, 1, 1],
    ],
    color: "#0000f0",
  },
];

// 🎲 7-bag
let bag = [];
const shuffle = (a) => a.sort(() => Math.random() - 0.5);
const getNextPiece = () => {
  if (!bag.length) bag = shuffle([...SHAPES]);
  return bag.pop();
};

const createBoard = () =>
  Array.from({ length: ROWS }, () => Array(COLS).fill(null));

const rotate = (s) => s[0].map((_, i) => s.map((r) => r[i]).reverse());

export default function Tetris() {
  const canvasRef = useRef(null);
  const keys = useRef({});
  const keyState = useRef({
    ArrowLeft: { pressed: false, start: 0, last: 0 },
    ArrowRight: { pressed: false, start: 0, last: 0 },
  });

  const [board, setBoard] = useState(createBoard());
  const [piece, setPiece] = useState(null);
  const [next, setNext] = useState(null);
  const [hold, setHold] = useState(null);
  const [canHold, setCanHold] = useState(true);
  const [score, setScore] = useState(0);
  const [lastRotate, setLastRotate] = useState(false);
  const [lockStart, setLockStart] = useState(null);

  const spawn = () => {
    const p = next || getNextPiece();
    setPiece({ ...p, x: 4, y: 0 });
    setNext(getNextPiece());
    setCanHold(true);
    setLockStart(null);
    setLastRotate(false);
  };

  useEffect(() => {
    setNext(getNextPiece());
    spawn();
  }, []);

  const collide = (b, p) =>
    p.shape.some((r, y) =>
      r.some((v, x) => {
        if (!v) return false;
        const nx = p.x + x,
          ny = p.y + y;
        return nx < 0 || nx >= COLS || ny >= ROWS || b[ny]?.[nx];
      }),
    );

  const merge = (b, p) => {
    const nb = b.map((r) => [...r]);
    p.shape.forEach((r, y) =>
      r.forEach((v, x) => {
        if (v) nb[p.y + y][p.x + x] = p.color;
      }),
    );
    return nb;
  };

  // 🧠 T-spin
  const isTSpin = (p) => {
    if (p.name !== "T" || !lastRotate) return false;

    const cx = p.x + 1;
    const cy = p.y + 1;
    let corners = 0;

    [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ].forEach(([dx, dy]) => {
      const x = cx + dx,
        y = cy + dy;
      if (x < 0 || x >= COLS || y >= ROWS || board[y]?.[x]) corners++;
    });

    return corners >= 3;
  };

  const clearLines = (b, p) => {
    let lines = 0;
    let nb = b.filter((row) => {
      if (row.every((c) => c)) {
        lines++;
        return false;
      }
      return true;
    });

    while (nb.length < ROWS) nb.unshift(Array(COLS).fill(null));

    if (lines) {
      const tspin = isTSpin(p);
      setScore((s) => s + (tspin ? lines * 400 : lines * 100));
    }

    setBoard(nb);
  };

  const tryMove = (np) => {
    if (!collide(board, np)) {
      setPiece(np);
      setLockStart(null);
      return true;
    }
    return false;
  };

  const drop = () => {
    if (!piece) return;
    const np = { ...piece, y: piece.y + 1 };

    if (!collide(board, np)) {
      setPiece(np);
      setLockStart(null);
    } else {
      if (!lockStart) setLockStart(Date.now());
      else if (Date.now() - lockStart > LOCK_DELAY) {
        const merged = merge(board, piece);
        clearLines(merged, piece);
        spawn();
      }
    }
  };

  const hardDrop = () => {
    let p = { ...piece };
    while (!collide(board, { ...p, y: p.y + 1 })) p.y++;
    const merged = merge(board, p);
    clearLines(merged, p);
    setScore((s) => s + (p.y - piece.y) * 2);
    spawn();
  };

  const holdPiece = () => {
    if (!canHold) return;

    if (!hold) {
      setHold(piece);
      spawn();
    } else {
      const t = hold;
      setHold(piece);
      setPiece({ ...t, x: 4, y: 0 });
    }
    setCanHold(false);
  };

  // ⌨️ input
  useEffect(() => {
    const down = (e) => {
      keys.current[e.code] = true;

      if (keyState.current[e.code]) {
        const k = keyState.current[e.code];
        if (!k.pressed) {
          k.pressed = true;
          k.start = Date.now();

          if (e.code === "ArrowLeft") tryMove({ ...piece, x: piece.x - 1 });
          if (e.code === "ArrowRight") tryMove({ ...piece, x: piece.x + 1 });
        }
      }

      // 🔁 ROTATION WITH WALL KICKS
      if (e.code === "ArrowUp") {
        const rotated = rotate(piece.shape);

        const kicks = [
          { x: 0, y: 0 },
          { x: -1, y: 0 },
          { x: 1, y: 0 },
          { x: -2, y: 0 },
          { x: 2, y: 0 },
          { x: 0, y: -1 },
        ];

        for (let k of kicks) {
          const np = {
            ...piece,
            shape: rotated,
            x: piece.x + k.x,
            y: piece.y + k.y,
          };

          if (!collide(board, np)) {
            setPiece(np);
            setLastRotate(true);
            setLockStart(null);
            break;
          }
        }
      }

      if (e.code === "Space") hardDrop();
      if (e.code === "KeyC") holdPiece();
    };

    const up = (e) => {
      keys.current[e.code] = false;
      if (keyState.current[e.code]) keyState.current[e.code].pressed = false;
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [piece, hold]);

  // 🎮 movement loop
  useEffect(() => {
    const loop = setInterval(() => {
      const now = Date.now();

      ["ArrowLeft", "ArrowRight"].forEach((code) => {
        const k = keyState.current[code];
        if (!k.pressed) return;

        if (now - k.start > DAS && now - k.last > ARR) {
          const dir = code === "ArrowLeft" ? -1 : 1;
          tryMove({ ...piece, x: piece.x + dir });
          k.last = now;
        }
      });

      if (keys.current["ArrowDown"]) drop();
    }, 16);

    return () => clearInterval(loop);
  }, [piece, board]);

  // gravity
  useEffect(() => {
    const i = setInterval(drop, 500);
    return () => clearInterval(i);
  });

  // 👻 ghost
  const getGhost = () => {
    if (!piece) return null;
    let g = { ...piece };
    while (!collide(board, { ...g, y: g.y + 1 })) g.y++;
    return g;
  };

  // 🎨 draw
  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, COLS * BLOCK, ROWS * BLOCK);

    board.forEach((r, y) => {
      r.forEach((c, x) => {
        if (c) {
          ctx.fillStyle = c;
          ctx.fillRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);
        }
      });
    });

    const g = getGhost();
    if (g) {
      ctx.globalAlpha = 0.3;
      g.shape.forEach((r, y) => {
        r.forEach((v, x) => {
          if (v) {
            ctx.fillStyle = g.color;
            ctx.fillRect((g.x + x) * BLOCK, (g.y + y) * BLOCK, BLOCK, BLOCK);
          }
        });
      });
      ctx.globalAlpha = 1;
    }

    piece?.shape.forEach((r, y) => {
      r.forEach((v, x) => {
        if (v) {
          ctx.fillStyle = piece.color;
          ctx.fillRect(
            (piece.x + x) * BLOCK,
            (piece.y + y) * BLOCK,
            BLOCK,
            BLOCK,
          );
        }
      });
    });
  }, [board, piece]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "#020617",
        color: "white",
        gap: 20,
      }}
    >
      <canvas ref={canvasRef} width={COLS * BLOCK} height={ROWS * BLOCK} />
      <div>
        <p>Score: {score}</p>
        <p>← → move | ↑ rotate</p>
        <p>↓ soft | SPACE hard</p>
        <p>C hold</p>
      </div>
    </div>
  );
}
