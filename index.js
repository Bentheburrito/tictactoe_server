const server = require("http").createServer();
const io = require("socket.io")(server, {
	cors: {
		origin: "*",
	},
});

const PORT = 4000;
const NEW_GAME_MOVE_EVENT = "newGameMove";
const GAME_MOVE_REFUSAL = "badGameMove";
const NEW_PLAYER_EVENT = "newPlayer";
const LOAD_GAME_REQUEST = "loadGameReq";
const LOAD_GAME_ANSWER = "loadGameRes";

const games = [];

io.on("connection", socket => {
	console.log(`New connection with user ${socket.handshake.query.username}`);

	// Join a game
	const { username } = socket.handshake.query;

	let game;
	// Check if this player is already in a game (i.e. they reloaded tab)
	if (game = games.find(g => g.playerX.username === username || g.playerO && g.playerO.username === username)) {
		// determine whether this is player X or O
		const [player, otherPlayer] = game.playerX.username === username ? ['playerX', 'playerO'] : ['playerO', 'playerX'];
		// Reassign socket id
		game[player].socketId = socket.id;
		// Join this new connection to the game.
		socket.join(game.playerX.username);
		// Send only this player a NEW_PLAYER_EVENT so they can update their frontend.
		socket.emit(NEW_PLAYER_EVENT, { username: game[otherPlayer].username, isPlayerX: username === game.playerO.username });
		return;
	}

	// Try to find an available slot in a game. If none exist, make a new game.
	game = games.find(g => g.playerO === null);
	if (!game) {
		game = { playerX: { username, socketId: socket.id}, playerO: null, xIsNext: true, squares: Array(9).fill(null) };
		games.push(game);
	} else {
		game.playerO = { username, socketId: socket.id }
		socket.emit(NEW_PLAYER_EVENT, { username: game.playerX.username, isPlayerX: true });
	}
	
	console.log("game:")
	console.log(game)
	// console.log("games length: " + games.length)

	const gameId = game.playerX.username;
	socket.join(gameId);

	// console.log(`Sending a ${NEW_PLAYER_EVENT}`)
	socket.in(gameId).emit(NEW_PLAYER_EVENT, {username, isPlayerX: username === game.playerX.username});

	// Listen for new messages
	socket.on(NEW_GAME_MOVE_EVENT, ({ square, senderId }) => {
		if (senderId === game[game.xIsNext ? 'playerX' : 'playerO'].socketId && game.squares[square] === null) {
			game.xIsNext = !game.xIsNext;
			socket.in(gameId).emit(NEW_GAME_MOVE_EVENT, square);
		} else {
			socket.emit(GAME_MOVE_REFUSAL, square);
		}
	});

	// Leave the room if the user closes the socket
	socket.on("disconnect", () => {
		socket.leave(gameId);
	});
});

server.listen(PORT, () => {
	console.log(`Listening on port ${PORT}`);
});