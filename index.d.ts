type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
type Suit = 'spades' | 'hearts' | 'clubs' | 'diamonds';
interface Card {
  rank: Rank;
  suit: Suit;
}
type PlayerMove = 'swap' | 'stick' | 'hit deck';
type AdjustedPlayerMove = PlayerMove | 'attempted-swap';
interface Player {
  id: string;
  lives: number;
  card: Card | null;
  move: AdjustedPlayerMove | null;
}
interface LinkedPlayer extends Player {
  nextPlayer: LinkedPlayer;
}

declare type GameState = {
  players: { [playerId: string]: Player };
  orderedPlayerIds: string[];
  dealerId: string | null;
  activePlayerId: string | null;
  version: number;
};
declare interface GameStateStore {
  dispatch: (action: StateChangeAction) => GameState;
  getState: () => GameState;
  history: StateChangeAction[];
  initialState: GameState;
}
type StateChangeCallback = (action: StateChangeAction, version: number) => void;
declare interface ModiGameController {
  start();
  handleMove(playerId: string, move: PlayerMove): 'success' | 'failed';
  setDealerId(playerId: string);
}

type Connections = {
  [playerId: string]: { username: string; connected: boolean };
};

type PlayerId = string;
declare type StateChangeAction =
  | { type: 'HIGHCARD_WINNERS'; payload: { playerIds: string[] } }
  | {
      type: 'START_ROUND';
      payload: { dealerId: string; activePlayerId: string };
    }
  | { type: 'DEALT_CARDS'; payload: { cards: [Card, PlayerId][] } }
  | { type: 'REMOVE_CARDS' }
  | { type: 'PLAYER_HIT_DECK'; payload: { playerId: string; card: Card } }
  | {
      type: 'PLAYERS_TRADED';
      payload: { fromPlayerId: string; toPlayerId: string };
    };

interface IDeck {
  cards: Card[];
  trash: Card[];
  shuffle();
  pop(): Card;
  popMany(n: number): Card[];
}
