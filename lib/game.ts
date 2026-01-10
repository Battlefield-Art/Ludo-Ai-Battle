import { GameState, PlayerColor, Piece, Move, AIResponse } from '@/types/game';

const BOARD_SIZE = 52;
const HOME_START: Record<PlayerColor, number> = {
  red: 0,
  blue: 13,
  yellow: 26,
  green: 39,
};

export function createInitialState(gameId: string, models: string[]): GameState {
  const colors: PlayerColor[] = ['red', 'blue', 'yellow', 'green'];
  return {
    gameId,
    status: 'active',
    players: colors.map((color, i) => ({
      color,
      model: models[i] || 'openai',
      piecesState: Array.from({ length: 4 }, (_, j) => ({
        pieceId: j,
        color,
        position: -1, // -1 means home
      })),
    })),
    currentPlayerIndex: 0,
    moveHistory: [],
    diceRoll: null,
    createdAt: Date.now(),
  };
}

export function getValidMoves(gameState: GameState, diceRoll: number): any[] {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const moves: any[] = [];

  currentPlayer.piecesState.forEach((piece) => {
    if (piece.position === 52) return; // Already finished

    if (piece.position === -1) {
      if (diceRoll === 6) {
        moves.push({
          pieceId: piece.pieceId,
          action: 'start',
          targetPosition: 0, // Position 0 means just started
        });
      }
    } else {
      const newPos = piece.position + diceRoll;
      if (newPos <= 52) {
        // Check for capture
        const boardPos = getBoardPosition(currentPlayer.color, newPos);
        const opponentPiece = findOpponentPieceAt(gameState, boardPos, currentPlayer.color);
        
        moves.push({
          pieceId: piece.pieceId,
          action: (newPos < 52 && opponentPiece) ? 'capture' : 'move',
          targetPosition: newPos,
        });
      }
    }
  });

  return moves;
}

export function getBoardPosition(color: PlayerColor, distance: number): number {
  if (distance === -1 || distance === 52) return -1;
  return (HOME_START[color] + distance) % BOARD_SIZE;
}

function findOpponentPieceAt(gameState: GameState, boardPosition: number, currentColor: PlayerColor): { playerIndex: number, pieceId: number } | null {
  if (boardPosition === -1) return null;
  
  // Safe squares in Ludo: 0, 8, 13, 21, 26, 34, 39, 47 (relative to Red's start)
  const safeSquares = [0, 8, 13, 21, 26, 34, 39, 47];
  if (safeSquares.includes(boardPosition)) return null;

  for (let i = 0; i < gameState.players.length; i++) {
    const player = gameState.players[i];
    if (player.color === currentColor) continue;
    for (const piece of player.piecesState) {
      if (piece.position >= 0 && piece.position < 52) {
        if (getBoardPosition(player.color, piece.position) === boardPosition) {
          return { playerIndex: i, pieceId: piece.pieceId };
        }
      }
    }
  }
  return null;
}

export function applyMove(gameState: GameState, move: AIResponse, diceRoll: number): GameState {
  const newState = JSON.parse(JSON.stringify(gameState)) as GameState;
  const playerIndex = newState.currentPlayerIndex;
  const player = newState.players[playerIndex];
  const piece = player.piecesState.find((p) => p.pieceId === move.pieceId)!;

  const fromPosition = piece.position;
  let toPosition = move.targetPosition;

  if (move.action === 'start') {
    piece.position = 0;
  } else {
    piece.position = toPosition;
    
    if (move.action === 'capture' && toPosition < 52) {
      const boardPos = getBoardPosition(player.color, toPosition);
      const opponent = findOpponentPieceAt(newState, boardPos, player.color);
      if (opponent) {
        newState.players[opponent.playerIndex].piecesState[opponent.pieceId].position = -1;
        newState.players[opponent.playerIndex].piecesState[opponent.pieceId].captured = true;
      }
    }
  }

  newState.moveHistory.push({
    playerColor: player.color,
    pieceId: move.pieceId,
    diceRoll,
    fromPosition,
    toPosition: piece.position,
    action: move.action,
    reasoning: move.reasoning,
    timestamp: Date.now(),
  });

  // Check if player won
  const allFinished = player.piecesState.every((p) => p.position === 52);
  if (allFinished) {
    if (!newState.finalRanking) newState.finalRanking = [];
    if (!newState.finalRanking.includes(player.color)) {
      newState.finalRanking.push(player.color);
    }
    
    // Check if game is over
    const finishedPlayers = newState.players.filter(p => p.piecesState.every(ps => ps.position === 52)).length;
    if (finishedPlayers >= 3) {
      // Find the last player
      const lastPlayer = newState.players.find(p => !newState.finalRanking?.includes(p.color));
      if (lastPlayer && !newState.finalRanking?.includes(lastPlayer.color)) {
          newState.finalRanking.push(lastPlayer.color);
      }
      newState.status = 'completed';
      newState.completedAt = Date.now();
    }
  }

  // Next player turn
  // If roll is 6, same player goes again, unless they just finished all pieces
  const shouldGetAnotherTurn = diceRoll === 6 && !allFinished;
  
  if (!shouldGetAnotherTurn) {
      newState.currentPlayerIndex = (newState.currentPlayerIndex + 1) % 4;
      // Skip players who have finished
      let attempts = 0;
      while (newState.players[newState.currentPlayerIndex].piecesState.every(p => p.position === 52) && attempts < 4 && newState.status === 'active') {
          newState.currentPlayerIndex = (newState.currentPlayerIndex + 1) % 4;
          attempts++;
      }
  }

  return newState;
}
