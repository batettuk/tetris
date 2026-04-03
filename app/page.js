"use client";
import { useEffect, useRef, useState } from "react";

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const DAS = 120;
const ARR = 30;
const LOCK_DELAY = 500;

// 🎨 better colors
const SHAPES = [
  { name: "I", shape: [[1, 1, 1, 1]], color: "#22d3ee" },
  {
    name: "O",
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: "#fde047",
  },
  {
    name: "T",
    shape: [
      [0, 1, 0],
      [1, 1, 1],
    ],
    color: "#c084fc",
  },
  {
    name: "L",
    shape: [
      [1, 0, 0],
      [1, 1, 1],
    ],
    color: "#fb923c",
  },
  {
    name: "J",
    shape: [
      [0, 0, 1],
      [1, 1, 1],
    ],
    color: "#60a5fa",
  },

  // ✅ NEW ONES
  {
    name: "S",
    shape: [
      [0, 1, 1],
      [1, 1, 0],
    ],
    color: "#4ade80",
  },
  {
    name: "Z",
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
    color: "#f87171",
  },
];

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
  const [gameOver, setGameOver] = useState(true);
  const [clearingRows, setClearingRows] = useState([]);

  const spawn = () => {
    const p = next || getNextPiece();
    const newPiece = { ...p, x: 4, y: 0 };

    if (collide(board, newPiece)) {
      setGameOver(true);
      return;
    }

    setPiece(newPiece);
    setNext(getNextPiece());
    setCanHold(true);
    setLockStart(null);
    setLastRotate(false);
  };

  const startGame = () => {
    bag = [];
    setBoard(createBoard());
    setScore(0);
    setHold(null);
    setNext(getNextPiece());
    setGameOver(false);
    setTimeout(spawn, 0);
  };

  useEffect(() => {
    setNext(getNextPiece());
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
    let rows = [];
    b.forEach((row, i) => {
      if (row.every((c) => c)) rows.push(i);
    });

    if (rows.length) {
      setClearingRows(rows);

      setTimeout(() => {
        let nb = b.filter((_, i) => !rows.includes(i));
        while (nb.length < ROWS) nb.unshift(Array(COLS).fill(null));

        const tspin = isTSpin(p);
        setScore((s) => s + (tspin ? rows.length * 400 : rows.length * 100));

        setBoard(nb);
        setClearingRows([]);
      }, 120);
    } else {
      setBoard(b);
    }
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
    if (!piece || gameOver) return;

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
    if (gameOver) return;
    let p = { ...piece };
    while (!collide(board, { ...p, y: p.y + 1 })) p.y++;
    const merged = merge(board, p);
    clearLines(merged, p);
    setScore((s) => s + (p.y - piece.y) * 2);
    spawn();
  };

  const holdPiece = () => {
    if (!canHold || gameOver) return;

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

  useEffect(() => {
    const down = (e) => {
      if (gameOver) return;

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
  }, [piece, hold, gameOver]);

  useEffect(() => {
    const loop = setInterval(() => {
      if (gameOver) return;

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
  }, [piece, board, gameOver]);

  useEffect(() => {
    const i = setInterval(drop, 500);
    return () => clearInterval(i);
  });

  const getGhost = () => {
    if (!piece) return null;
    let g = { ...piece };
    while (!collide(board, { ...g, y: g.y + 1 })) g.y++;
    return g;
  };

  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");

    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, COLS * BLOCK, ROWS * BLOCK);

    // grid
    ctx.strokeStyle = "#0f172a";
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        ctx.strokeRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);
      }
    }

    board.forEach((r, y) => {
      r.forEach((c, x) => {
        if (c) {
          if (clearingRows.includes(y)) {
            ctx.fillStyle = "white";
            ctx.fillRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);
          } else {
            drawBlock(ctx, x, y, c);
          }
        }
      });
    });

    const g = getGhost();
    if (g) {
      ctx.globalAlpha = 0.25;
      g.shape.forEach((r, y) => {
        r.forEach((v, x) => {
          if (v) {
            drawBlock(ctx, g.x + x, g.y + y, g.color, true);
          }
        });
      });
      ctx.globalAlpha = 1;
    }

    piece?.shape.forEach((r, y) => {
      r.forEach((v, x) => {
        if (v) {
          drawBlock(ctx, piece.x + x, piece.y + y, piece.color);
        }
      });
    });
  }, [board, piece, clearingRows]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-black via-slate-900 to-black text-white gap-6">
      <div className="flex items-center gap-10">
        <div className="flex flex-col items-center gap-3">
          <h2 className="text-sm tracking-widest text-gray-400">HOLD</h2>
          <div className="w-24 h-24 flex items-center justify-center bg-black border border-slate-700 rounded-lg">
            {hold && <Mini shape={hold} />}
          </div>
        </div>

        <div className="relative p-3 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-900 shadow-[0_0_40px_rgba(56,189,248,0.6)]">
          <canvas
            ref={canvasRef}
            width={COLS * BLOCK}
            height={ROWS * BLOCK}
            className="rounded-md bg-slate-900"
          />

          {gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-md">
              <h1 className="text-2xl font-bold mb-4 text-red-500">
                GAME OVER
              </h1>
              <button
                onClick={startGame}
                className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 rounded-lg font-bold"
              >
                PLAY AGAIN
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-4">
          <h2 className="text-sm tracking-widest text-gray-400">NEXT</h2>
          <div className="w-24 h-24 flex items-center justify-center bg-black border border-slate-700 rounded-lg">
            {next && <Mini shape={next} />}
          </div>

          <div className="w-32 p-3 text-center bg-black border border-cyan-400 rounded-lg shadow-[0_0_20px_rgba(56,189,248,0.5)]">
            <div className="text-xs text-gray-400">SCORE</div>
            <div className="text-2xl font-bold text-cyan-400">{score}</div>
          </div>
        </div>
      </div>

      {gameOver && (
        <button
          onClick={startGame}
          className="px-8 py-3 bg-cyan-500 hover:bg-cyan-400 rounded-xl font-bold text-lg"
        >
          PLAY
        </button>
      )}
    </div>
  );
}

function drawBlock(ctx, x, y, color, ghost = false) {
  const px = x * BLOCK;
  const py = y * BLOCK;

  ctx.fillStyle = color;
  ctx.fillRect(px, py, BLOCK, BLOCK);

  ctx.strokeStyle = ghost ? "rgba(255,255,255,0.2)" : "#020617";
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, BLOCK, BLOCK);

  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath();
  ctx.moveTo(px, py + BLOCK);
  ctx.lineTo(px, py);
  ctx.lineTo(px + BLOCK, py);
  ctx.stroke();

  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.moveTo(px + BLOCK, py);
  ctx.lineTo(px + BLOCK, py + BLOCK);
  ctx.lineTo(px, py + BLOCK);
  ctx.stroke();
}

function Mini({ shape }) {
  return (
    <div>
      {shape.shape.map((row, y) => (
        <div key={y} className="flex">
          {row.map((v, x) => (
            <div
              key={x}
              className="w-4 h-4 border border-slate-700"
              style={{ background: v ? shape.color : "transparent" }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
