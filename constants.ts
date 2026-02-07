
export const TILE_SIZE = 64;
export const PLAYER_SPEED = 240; 
export const ENEMY_SPEED_BASE = 150; 
export const COLLISION_PADDING = 16;
export const PROJECTILE_SPEED = 700; 

export const MAZE_STYLE = {
  wallBody: '#050515', // معدن داكن جداً
  wallTop: '#1a1a3a',  // سطح علوي مصقول
  wallBorder: '#00d2ff', // أزرق سيبراني متوهج
  circuitLine: '#00f2ff55', // خطوط دوائر نابضة
  floor: '#02020a',
  floorGrid: '#6c5ce711', 
  zoneActive: '#00f2ff',
  zoneIdle: '#4a90e222'
};

const STANDARD_MAZE = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 2, 1],
  [1, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
  [1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1],
  [1, 0, 0, 0, 1, 0, 0, 2, 0, 0, 1, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

const OPEN_MAZE = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 2, 1],
  [1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1],
  [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
  [1, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 0, 1],
  [1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1],
  [1, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 0, 1],
  [1, 0, 1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1, 0, 1],
  [1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

export const LEVELS = [
  {
    id: 1,
    question: "ما هي عاصمة المغرب؟",
    options: [
      { text: "الرباط", isCorrect: true, pos: { x: 1, y: 1 } },
      { text: "الدار البيضاء", isCorrect: false, pos: { x: 13, y: 1 } },
      { text: "مراكش", isCorrect: false, pos: { x: 7, y: 9 } }
    ],
    maze: STANDARD_MAZE,
    startPos: { x: 7, y: 5 },
    enemies: [{ x: 3, y: 3 }, { x: 11, y: 3 }]
  },
  {
    id: 2,
    question: "كم عدد أيام الأسبوع؟",
    options: [
      { text: "خمسة", isCorrect: false, pos: { x: 1, y: 1 } },
      { text: "سبعة", isCorrect: true, pos: { x: 13, y: 1 } },
      { text: "ثمانية", isCorrect: false, pos: { x: 7, y: 7 } }
    ],
    maze: OPEN_MAZE,
    startPos: { x: 7, y: 5 },
    enemies: [{ x: 1, y: 9 }, { x: 13, y: 9 }, { x: 7, y: 1 }]
  },
  {
    id: 3,
    question: "أي كوكب يُعرف بالكوكب الأحمر؟",
    options: [
      { text: "الزهرة", isCorrect: false, pos: { x: 1, y: 1 } },
      { text: "المريخ", isCorrect: true, pos: { x: 13, y: 1 } },
      { text: "المشتري", isCorrect: false, pos: { x: 7, y: 9 } }
    ],
    maze: STANDARD_MAZE,
    startPos: { x: 7, y: 5 },
    enemies: [{ x: 2, y: 3 }, { x: 12, y: 3 }, { x: 7, y: 3 }]
  },
  {
    id: 4,
    question: "ما هي أكبر قارة في العالم؟",
    options: [
      { text: "إفريقيا", isCorrect: false, pos: { x: 1, y: 1 } },
      { text: "آسيا", isCorrect: true, pos: { x: 13, y: 1 } },
      { text: "أوروبا", isCorrect: false, pos: { x: 7, y: 7 } }
    ],
    maze: OPEN_MAZE,
    startPos: { x: 7, y: 5 },
    enemies: [{ x: 5, y: 5 }, { x: 9, y: 5 }]
  },
  {
    id: 5,
    question: "كم عدد الحواس الأساسية عند الإنسان؟",
    options: [
      { text: "أربع", isCorrect: false, pos: { x: 1, y: 1 } },
      { text: "خمس", isCorrect: true, pos: { x: 13, y: 1 } },
      { text: "ست", isCorrect: false, pos: { x: 7, y: 9 } }
    ],
    maze: STANDARD_MAZE,
    startPos: { x: 7, y: 5 },
    enemies: [{ x: 1, y: 1 }, { x: 13, y: 1 }, { x: 1, y: 9 }]
  }
];
