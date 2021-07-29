import {
	NEW_MOVE_EVENT,
	GAME_MOVE_REFUSAL,
	NEW_PLAYER_EVENT, 
	LOAD_GAME_EVENT, 
	PLAY_AGAIN_EVENT, 
	NEW_GAME_EVENT
} from './constants.js';

export const connectToGame = (socket, games, newGameRequests, shouldSetListeners = true) => {
	console.log(`New connection with user ${socket.handshake.query.username}`);

	const { username } = socket.handshake.query;

	let game = findOrCreateGame(socket, games, username);

	const gameId = game.playerX.username;
	socket.join(gameId);

	if (shouldSetListeners) setListeners(socket, game, gameId, username, games, newGameRequests);
}

const findOrCreateGame = (newPlayerSocket, games, username) => {
	let game;
	// Check if this player is already in a game (i.e. they reloaded tab)
	if (game = games.find(g => g.playerX.username === username || (g.playerO && g.playerO.username === username))) {
		// determine whether this is player X or O
		const [player, otherPlayer] = game.playerX.username === username ? ['playerX', 'playerO'] : ['playerO', 'playerX'];
		// Reassign socket id
		game[player].socket = newPlayerSocket;
		// Send only this player a NEW_PLAYER_EVENT so they can update their frontend.
		newPlayerSocket.emit(NEW_PLAYER_EVENT, { username: game[otherPlayer].username, isPlayerX: otherPlayer === 'playerX', squares: game.squares });
		// Otherwise, this player is not in a game, so look for/create a game
	} else {
		// Try to find an available slot in a game. If none exist, make a new game.
		game = games.find(g => g.playerO === null);
		if (!game) {
			// If all games are full
			game = { playerX: { username, socket: newPlayerSocket }, playerO: null, xIsNext: true, squares: Array(9).fill(null) };
			games.push(game);
		} else {
			// If a game with an empty slot exists
			game.playerO = { username, socket: newPlayerSocket }
			newPlayerSocket.in(game.playerX.username).emit(NEW_PLAYER_EVENT, { username: game.playerO.username, isPlayerX: false, squares: game.squares });
			newPlayerSocket.emit(NEW_PLAYER_EVENT, { username: game.playerX.username, isPlayerX: true, squares: game.squares });
		}
	}
	return game;
}

const setListeners = (socket, game, gameId, username, games, newGameRequests) => {
	// Listen for new messages
	socket.on(NEW_MOVE_EVENT, ({ square, senderId }) => {
		if (senderId === game[game.xIsNext ? 'playerX' : 'playerO'].socket.id && game.squares[square] === null) {
			game.squares[square] = game.xIsNext ? 'X' : 'O'
			game.xIsNext = !game.xIsNext;
			socket.in(gameId).emit(NEW_MOVE_EVENT, square);
		} else {
			socket.emit(GAME_MOVE_REFUSAL, square);
		}
		console.log(games);
	});

	socket.on(PLAY_AGAIN_EVENT, () => {
		if (!newGameRequests[gameId]) newGameRequests[gameId] = [];
		if (!newGameRequests[gameId].includes(username)) {
			newGameRequests[gameId].push(username);
			socket.in(gameId).emit(PLAY_AGAIN_EVENT, {});
		}
		// If both players have requested a new game, start a new game (by sending an empty board)
		if (newGameRequests[gameId].length === 2) {
			newGameRequests[gameId] = [];

			const newBoard = newGameBoard();
			socket.in(gameId).emit(LOAD_GAME_EVENT, newBoard);
			socket.emit(LOAD_GAME_EVENT, newBoard);
			game.squares = newBoard;
			game.xIsNext = true;
		}
	});

	socket.on(NEW_GAME_EVENT, () => {
		const [player, otherPlayer] = game.playerX.username === username ? ['playerX', 'playerO'] : ['playerO', 'playerX'];
		const gameIndex = games.indexOf(game);
		if (gameIndex === -1) return console.log(`Error: Game ${gameId} not found`);
		games.splice(gameIndex, 1);

		const otherSocket = game[otherPlayer].socket;
		cleanup(socket);
		cleanup(otherSocket);

		connectToGame(socket, games, newGameRequests);
		connectToGame(otherSocket, games, newGameRequests);
	});

	// Leave the room if the user closes the socket
	socket.on("disconnect", () => {
		cleanup(socket, gameId);
	});
}

const cleanup = (socket, gameId) => {
	socket.leave(gameId);
	socket.removeAllListeners();
}

const newGameBoard = () => Array(9).fill(null);