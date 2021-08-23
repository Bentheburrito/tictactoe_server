import http from 'http';
import { Server } from 'socket.io';
import { PORT } from './game/constants.js';
import { connectToGame } from './game/game.js';

const server = http.createServer();
let io = new Server(server, {
	cors: {
		origin: "*",
	},
});

const games = [];
const newGameRequests = {}; // { gameId: [usernameX, usernameO] }
const loadGameRequests = {}; // { gameId: {usernameX: { squares | null }, usernameO: { squares | null } }

io.on("connection", socket => {
	connectToGame(socket, games, newGameRequests, loadGameRequests);
});

server.listen(PORT, () => {
	console.log(`Listening on port ${PORT}`);
});