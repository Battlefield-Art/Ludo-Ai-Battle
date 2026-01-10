export interface ModelAnalytics {
  modelName: string;
  winRateTrend: TrendPoint[];
  eloProgression: TrendPoint[];
  responseTimeTrend: TrendPoint[];
  errorRateTrend: TrendPoint[];
  strategyPatterns: StrategyPattern[];
}

export interface TrendPoint {
  timestamp: number;
  value: number;
  label?: string;
}

export interface StrategyPattern {
  pattern: string;
  frequency: number;
  successRate: number;
}

export interface GameAnalytics {
  totalGames: number;
  activeGames: number;
  completedGames: number;
  averageDuration: number;
  durationByMatchup: Record<string, number>;
  capturePatterns: CapturePattern[];
  piecePositionHeatmap: Record<number, number>;
  winningPatterns: WinningPattern[];
}

export interface CapturePattern {
  capturer: string;
  captured: string;
  frequency: number;
  averagePosition: number;
}

export interface WinningPattern {
  pattern: string;
  description: string;
  frequency: number;
  avgWinTime: number;
}

export interface AnalyticsInsights {
  topPerformer: string;
  mostImprovedModel: string;
  mostConsistentModel: string;
  peakActivityHour: number;
  averageGameDuration: number;
  totalPiecesCapture: number;
  fastestGame: {
    gameId: string;
    duration: number;
    winner: string;
  };
  longestGame: {
    gameId: string;
    duration: number;
    winner: string;
  };
}

export interface RatingDistribution {
  range: string;
  count: number;
  models: string[];
}
