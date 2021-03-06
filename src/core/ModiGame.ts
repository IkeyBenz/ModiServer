import { groupSort, rotateInPlace } from '../util';
import ModiPlayer from './Player';
import Deck from './Deck';

// Todo: separate out into multiple files, especially redux logic
class ModiGame {
  private _players: ModiPlayer[];
  private _deck: Deck;
  private gameStateStore: ModiGameStateStore;

  constructor(
    players: { id: string; username: string }[],
    onGameStateChanged: (newState: ModiGameState) => void,
  ) {
    this._players = players.map(
      ({ id, username }) => new ModiPlayer(id, username),
    );
    this.gameStateStore = createModiGameStateStore(this.createInitialState());
    onGameStateChanged(this.gameStateStore.getState());

    this.gameStateStore.subscribe(() => {
      const newState = this.gameStateStore.getState();
      onGameStateChanged(newState);
    });

    this._deck = new Deck();
  }

  public start() {
    const initialDealer = this.playHighcard();
    this.startRound(initialDealer.id);
  }

  public startRound(dealerId: string) {
    const currPlayerOrder = this.gameStateStore.getState().players;
    const dealerIdx = currPlayerOrder.findIndex(
      (player) => player.id === dealerId,
    );
    const numArrRotations = currPlayerOrder.length - (dealerIdx + 1);
    rotateInPlace(currPlayerOrder, numArrRotations);

    this.gameStateStore.dispatch(newRound(currPlayerOrder));

    // Kickoff round
    this.dealPlayersCards();
  }

  public handleMove(
    playerId: string,
    move: PlayerMove,
    handleEndOfRound = true,
  ) {
    const players = this.getState().players;
    const playersWithCards = players.filter((player) => !!player.card);

    const playerIdx = players.findIndex((player) => player.id === playerId);
    const activePlayerIdx = playersWithCards.findIndex(
      (player) => player.id === playerId,
    );

    const isDealer = activePlayerIdx === playersWithCards.length - 1;

    if (isDealer) {
      if (move === 'swap') {
        const hitCard = this._deck.pop();
        players[playerIdx].setCard(hitCard);
      }
      this.gameStateStore.dispatch(addMove(move));
      this.gameStateStore.dispatch(updatePlayers(this.getState().players));
      handleEndOfRound && this.handleEndOfRound();
    } else {
      if (move == 'swap') {
        const nextPlayer = playersWithCards[activePlayerIdx + 1]!;
        if (nextPlayer.card!.rank === 13) {
          this.gameStateStore.dispatch(addMove('attempted-swap'));
        } else {
          this.gameStateStore.dispatch(addMove('swap'));
          players[playerIdx].tradeCardsWith(nextPlayer);
          this.gameStateStore.dispatch(updatePlayers(this.getState().players));
        }
      } else {
        this.gameStateStore.dispatch(addMove('stick'));
      }
    }
  }

  public getState() {
    return this.gameStateStore.getState();
  }

  private playHighcard(players = this.getState().players): IModiPlayer {
    this.dealPlayersCards(players);

    const rankedPlayers = groupSort(
      this.playersWithCards,
      (player) => player.card!.rank,
    );

    this.removePlayersCards();

    const winners = rankedPlayers[rankedPlayers.length - 1];
    if (winners.length > 1) {
      return this.playHighcard(winners);
    }

    return winners[0];
  }

  private handleEndOfRound() {
    const players = this.getState().players;
    const playersWithCards = players.filter((player) => !!player.card);
    const rankedPlayers = groupSort(
      playersWithCards,
      (player) => player.card!.rank,
    );
    this.removePlayersCards();

    const [losers] = rankedPlayers;

    const previousDealer = playersWithCards[playersWithCards.length - 1];

    this.gameStateStore.dispatch(
      updatePlayers(
        players.map((player) => {
          if (losers.includes(player)) {
            player.loseLife();
          }
          return player;
        }),
      ),
    );

    this.gameStateStore.dispatch(resetMoves());

    const playersStillAlive = players.filter((player) => player.isAlive);

    if (playersStillAlive.length > 1) {
      const newDealerId =
        playersStillAlive[playersStillAlive.indexOf(previousDealer) - 1].id;
      this.startRound(newDealerId);
    } else if (playersStillAlive.length === 0) {
      this.handleDoubleGame();
    }
  }

  private handleDoubleGame() {
    this._players.forEach((player) => player.revive());
    const playersFromLastRound = this.getState().players;
    this.gameStateStore.dispatch(updatePlayers(this._players));
    this.startRound(playersFromLastRound[playersFromLastRound.length - 1].id);
  }

  private createInitialState(): ModiGameState {
    return {
      round: 0,
      moves: [],
      players: this._players,
      _stateVersion: -2, // idk, reducer fires twice on init
    };
  }

  private removePlayersCards() {
    const players = this.playersWithCards;
    players.forEach((player) => player.removeCard());
    this.gameStateStore.dispatch(updatePlayers(players));
  }

  private dealPlayersCards(players = this.getState().players) {
    players.forEach((player) => {
      if (player.isAlive) {
        player.setCard(this._deck.pop());
      }
    });
    this.gameStateStore.dispatch(updatePlayers(players));
  }

  private get playersWithCards(): ModiPlayer[] {
    return this.getState().players.filter((player) => !!player.card);
  }
}

// Redux stuff
import { createStore } from 'redux';

/**
 * Creates a redux store instance to keep track of a ModiGame instance's state.
 * @param {ModiGameState} initialGameState The initial game state for the store
 * @return {Store<ModiGameState, ModiGameStateAction>} The redux store instance
 */
function createModiGameStateStore(initialGameState: ModiGameState) {
  /**
   * A function to modify a ModiGameState object using one of the ModiGameStateAction's
   * @param {ModiGameState} state The initial state for the gamestate reducer to reduce
   * @param {ModiGameStateAction} action An action type that the reducer will use to update the state
   * @return {ModiGameState} The new state after having been reduced.
   */
  function gameStateReducer(
    state = initialGameState,
    action: ModiGameStateAction,
  ): ModiGameState {
    const newState = { ...state, _stateVersion: state._stateVersion + 1 };
    switch (action.type) {
      case 'PLAYERS_UPDATED': {
        const { players } = action.payload;
        return { ...newState, players };
      }
      case 'NEW_ROUND': {
        return {
          ...newState,
          round: newState.round + 1,
          players: action.payload.players,
        };
      }
      case 'MOVE_ADDED': {
        const { move } = action.payload;
        return { ...newState, moves: newState.moves.concat(move) };
      }
      case 'MOVES_RESET': {
        return { ...newState, moves: [] };
      }
      case 'SET_STATE':
        return action.payload.state;
      default:
        return newState;
    }
  }

  return createStore(gameStateReducer);
}

export const updatePlayers = (players: ModiPlayer[]): PlayersUpdatedAction => ({
  type: 'PLAYERS_UPDATED',
  payload: { players },
});

export const newRound = (players: ModiPlayer[]): NewRoundAction => ({
  type: 'NEW_ROUND',
  payload: { players },
});

export const addMove = (move: PlayerMove): MoveAddedAction => ({
  type: 'MOVE_ADDED',
  payload: { move },
});

export const resetMoves = (): MovesResetAction => ({
  type: 'MOVES_RESET',
});

export const setState = (state: ModiGameState): SetStateAction => ({
  type: 'SET_STATE',
  payload: { state },
});

export default ModiGame;
