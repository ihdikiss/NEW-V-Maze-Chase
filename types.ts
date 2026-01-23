
export interface Position {
  x: number;
  y: number;
}

export interface Enemy {
  id: string;
  pos: Position;
  path: Position[];
  pathIndex: number;
  speed: number;
}

export interface AnswerZone {
  id: string;
  rect: { x: number; y: number; width: number; height: number };
  text: string;
  isCorrect: boolean;
}

export interface Question {
  text: string;
  options: { text: string; isCorrect: boolean }[];
}

export enum GameState {
  LANDING = 'LANDING',
  INTRO = 'INTRO',
  BRIEFING = 'BRIEFING',
  PLAYING = 'PLAYING',
  RESULT = 'RESULT',
  GAME_OVER = 'GAME_OVER',
  PRO_SUCCESS = 'PRO_SUCCESS',
  ADMIN = 'ADMIN'
}

export enum CameraMode {
  CHASE = 'CHASE',
  FIELD = 'FIELD',
  MOBILE = 'MOBILE'
}

export interface GameLevel {
  maze: number[][];
  question: Question;
  enemies: Enemy[];
  answerZones: AnswerZone[];
  startPos: Position;
}