const { uniqueId } = require('../util');

class Lobby {
  constructor(namespace) {
    this.namespace = namespace;
    this.connected = {}
    this.namespace.on('connection', (s) => this.onUserConnected(s));
  }

  handleAddConnection(socket) {
    const { username } = socket.handshake.query;
    username && (this.connected[socket.id] = username);
    const lobbyInfo = this.getInfo();
    this.namespace.emit('lobby info', lobbyInfo);
  }

  onUserConnected(socket) {
    this.handleAddConnection(socket);
    socket.on('disconnect', () => this.handleRemoveConnection(socket));
  }

  handleRemoveConnection(socket) {
    delete this.connected[socket.id];

    const lobbyInfo = this.getInfo();
    this.namespace.emit('lobby info', lobbyInfo);
  }

  getInfo() {
    return {
      lobbyLeader: this.getLeader(),
      connectedPlayers: Object.keys(this.connected).map(id => ({
        id, username: this.connected[id],
      })),
    }
  }

  getLeader() {
    const leaderId = Object.keys(this.connected)[0];
    return { id: leaderId, username: this.connected[leaderId] };
  }

  isEmpty() {
    return Object.keys(this.connected).length === 0;
  }
}

class LobbyService {
  constructor (io) {
    this.io = io;
    this.lobbies = {}
  }

  createLobby() {
    const id = uniqueId(Object.keys(this.lobbies));
    this.lobbies[id] = new Lobby(this.io.of(`/lobbies/${id}`));
    return id;
  }

  removeLobby(id) {
    delete this.lobbies[id];
  }

  findById(id) {
    return this.lobbies[id] && this.lobbies[id].getInfo();
  }
}

module.exports = function createLobbyService (io) {
  return new LobbyService(io);
}