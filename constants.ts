
export const TILE_SIZE = 64;
// Values are now in pixels per second (Units/Sec)
// Calibrated for fair but challenging pursuit
export const PLAYER_SPEED = 180; 
export const ENEMY_SPEED_BASE = 160; 
export const COLLISION_PADDING = 16;
export const PROJECTILE_SPEED = 600; // Pixels per second

export const MAZE_STYLE = {
  wallBody: '#020010', // Deep Space Black
  wallTop: '#1a0033',  // Nebula Purple
  wallBorder: '#6c5ce7', // Galactic Violet
  wallHighlight: '#a29bfe', // Star Light
  wallCircuit: '#00d2ff', // Energy Stream
  wallShadow: 'rgba(0, 0, 0, 0.8)',
  floor: '#050515',
  floorGrid: 'rgba(108, 92, 231, 0.05)', // Cosmic Grid
  zoneFrame: '#4a90e2',
  zoneGlow: 'rgba(74, 144, 226, 0.4)',
  playerBody: '#ffffff',
  playerVisor: '#00d2ff',
  enemyBody: '#2d3436',
  enemyEye: '#ff4d4d',
  projectile: '#00f2ff',
  weaponPowerUp: '#ff9f43'
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
  // المستوى 1
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
  // المستوى 2
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
  // المستوى 3
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
  // المستوى 4
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
  // المستوى 5
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
  },
  // المستوى 6
  {
    id: 6,
    question: "ما هو العنصر الكيميائي الذي رمزه (O)؟",
    options: [
      { text: "الذهب", isCorrect: false, pos: { x: 1, y: 1 } },
      { text: "الأكسجين", isCorrect: true, pos: { x: 13, y: 1 } },
      { text: "الحديد", isCorrect: false, pos: { x: 7, y: 7 } }
    ],
    maze: OPEN_MAZE,
    startPos: { x: 7, y: 5 },
    enemies: [{ x: 4, y: 1 }, { x: 10, y: 1 }, { x: 7, y: 9 }]
  },
  // المستوى 7
  {
    id: 7,
    question: "في أي قارة تقع دولة اليابان؟",
    options: [
      { text: "أوروبا", isCorrect: false, pos: { x: 1, y: 1 } },
      { text: "آسيا", isCorrect: true, pos: { x: 13, y: 1 } },
      { text: "أستراليا", isCorrect: false, pos: { x: 7, y: 9 } }
    ],
    maze: STANDARD_MAZE,
    startPos: { x: 7, y: 5 },
    enemies: [{ x: 3, y: 7 }, { x: 11, y: 7 }]
  },
  // المستوى 8
  {
    id: 8,
    question: "من هو مخترع الهاتف؟",
    options: [
      { text: "توماس إديسون", isCorrect: false, pos: { x: 1, y: 1 } },
      { text: "غراهام بيل", isCorrect: true, pos: { x: 13, y: 1 } },
      { text: "نيوتن", isCorrect: false, pos: { x: 7, y: 7 } }
    ],
    maze: OPEN_MAZE,
    startPos: { x: 7, y: 5 },
    enemies: [{ x: 2, y: 2 }, { x: 12, y: 2 }, { x: 7, y: 8 }]
  },
  // المستوى 9
  {
    id: 9,
    question: "كم عدد الكواكب في المجموعة الشمسية؟",
    options: [
      { text: "سبعة", isCorrect: false, pos: { x: 1, y: 1 } },
      { text: "ثمانية", isCorrect: true, pos: { x: 13, y: 1 } },
      { text: "تسعة", isCorrect: false, pos: { x: 7, y: 9 } }
    ],
    maze: STANDARD_MAZE,
    startPos: { x: 7, y: 5 },
    enemies: [{ x: 1, y: 5 }, { x: 13, y: 5 }, { x: 7, y: 1 }, { x: 7, y: 9 }]
  }
];
