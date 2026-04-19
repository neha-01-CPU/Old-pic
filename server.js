const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*" }
});

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));

// Helper to keep names and chats clean
function sanitize(str) {
    if (typeof str !== 'string') return '';
    return DOMPurify.sanitize(str.trim().slice(0, 25), { ALLOWED_TAGS: [] });
}

const WORD_PACKS = {
    "Default": ["Sun", "Tree", "Fish", "House", "Ice cream", "Pizza", "Guitar", "Robot", "Airplane", "Spider", "Castle", "Snowman", "Train", "Rocket", "Dinosaur", "Camera", "Zebra", "Octopus", "Volcano", "Balloon"],
    "Animals": ["Dog", "Cat", "Lion", "Tiger", "Elephant", "Monkey", "Giraffe", "Penguin", "Dolphin", "Shark", "Snake"],
    "Food": ["Pizza", "Burger", "Apple", "Sushi", "Taco", "Cake", "Donut", "Cheese", "Coffee"],
    "Hard": ["Paradox", "Algorithm", "Symphony", "Philosophy", "Quantum", "Metamorphosis", "Consciousness"]
};

const rooms = new Map();
const PUBLIC_ROOM_CODE = 'PUBLIC_LOBBY';

function createNewGameState(options = {}) {
    return {
        isPublic: options.isPublic || false,
        state: 'waiting',
        players: [],
        currentRound: 0,
        currentWord: '',
        maskedWord: '',
        currentArtistId: null,
        usedWords: [],
        timer: 0,
        settings: { rounds: 3, drawTime: 90, wordPack: 'Default', customWords: [], ...options.settings },
        guessOrder: [],
        lastRoundData: null
    };
}

rooms.set(PUBLIC_ROOM_CODE, createNewGameState({ isPublic: true }));

function getSerializableGameState(room, playerId) {
    const isArtist = playerId === room.currentArtistId;
    return {
        isPublic: room.isPublic,
        state: room.state,
        players: room.players.map(p => ({
            ...p,
            isHost: room.players[0]?.id === p.id && !room.isPublic
        })),
        currentRound: room.currentRound,
        wordToDisplay: isArtist ? room.currentWord : room.maskedWord,
        wordLength: room.currentWord.length,
        currentArtistId: room.currentArtistId,
        timer: room.timer,
        settings: room.settings,
        lastRoundData: room.lastRoundData
    };
}

function broadcastGameState(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;
    room.players.forEach(player => {
        io.to(player.id).emit('gameStateUpdate', { 
            roomCode, 
            gameState: getSerializableGameState(room, player.id) 
        });
    });
}

io.on('connection', (socket) => {
    const findRoom = () => {
        for (const [code, room] of rooms.entries()) {
            if (room.players.some(p => p.id === socket.id)) return { code, room };
        }
        return { code: null, room: null };
    };

    socket.on('joinPublicGame', (playerData) => {
        const room = rooms.get(PUBLIC_ROOM_CODE);
        socket.join(PUBLIC_ROOM_CODE);
        room.players.push({ id: socket.id, name: sanitize(playerData.name), avatar: playerData.avatar, score: 0, hasGuessed: false });
        broadcastGameState(PUBLIC_ROOM_CODE);
        if (room.players.length >= 2 && room.state === 'waiting') startNextRound(PUBLIC_ROOM_CODE);
    });

    socket.on('createPrivateRoom', ({ playerData, settings }) => {
        const code = Math.random().toString(36).substring(2, 6).toUpperCase();
        rooms.set(code, createNewGameState({ settings }));
        const room = rooms.get(code);
        socket.join(code);
        room.players.push({ id: socket.id, name: sanitize(playerData.name), avatar: playerData.avatar, score: 0, hasGuessed: false });
        socket.emit('roomCreated', code);
        broadcastGameState(code);
    });

    socket.on('joinPrivateRoom', ({ roomCode, playerData }) => {
        const code = roomCode.toUpperCase();
        const room = rooms.get(code);
        if (!room) return socket.emit('error', 'Room not found');
        socket.join(code);
        room.players.push({ id: socket.id, name: sanitize(playerData.name), avatar: playerData.avatar, score: 0, hasGuessed: false });
        broadcastGameState(code);
    });

    socket.on('startGame', () => {
        const { code, room } = findRoom();
        if (room && room.players[0].id === socket.id) startNextRound(code);
    });

    socket.on('submitGuess', (guess) => {
        const { code, room } = findRoom();
        if (!room || room.state !== 'playing') return;
        const player = room.players.find(p => p.id === socket.id);
        if (!player || player.hasGuessed || socket.id === room.currentArtistId) return;

        if (guess.trim().toLowerCase() === room.currentWord.toLowerCase()) {
            player.hasGuessed = true;
            player.score += (room.timer * 10) + 500;
            io.to(code).emit('correctGuess', { playerId: player.id, playerName: player.name });
            broadcastGameState(code);
            if (room.players.filter(p => p.id !== room.currentArtistId).every(p => p.hasGuessed)) endRound(code, "All guessed!");
        } else {
            io.to(code).emit('chatMessage', { name: player.name, message: sanitize(guess), type: 'guess' });
        }
    });

    socket.on('wordChosen', (word) => {
        const { code, room } = findRoom();
        if (room && socket.id === room.currentArtistId) beginDrawing(code, word);
    });

    socket.on('drawingAction', (data) => {
        const { code } = findRoom();
        if (code) socket.to(code).emit('drawingAction', data);
    });

    socket.on('clearCanvas', () => {
        const { code } = findRoom();
        if (code) io.to(code).emit('clearCanvas');
    });

    socket.on('disconnect', () => {
        const { code, room } = findRoom();
        if (room) {
            room.players = room.players.filter(p => p.id !== socket.id);
            if (room.players.length === 0 && code !== PUBLIC_ROOM_CODE) rooms.delete(code);
            else broadcastGameState(code);
        }
    });
});

function startNextRound(code) {
    const room = rooms.get(code);
    if (!room || room.players.length < 2) return;
    room.state = 'choosing-word';
    room.currentRound++;
    room.players.forEach(p => p.hasGuessed = false);
    const artist = room.players[(room.currentRound - 1) % room.players.length];
    room.currentArtistId = artist.id;
    const words = WORD_PACKS[room.settings.wordPack].sort(() => 0.5 - Math.random()).slice(0, 3);
    io.to(artist.id).emit('chooseWord', words);
    broadcastGameState(code);
}

function beginDrawing(code, word) {
    const room = rooms.get(code);
    room.state = 'playing';
    room.currentWord = word;
    room.maskedWord = word.replace(/[a-zA-Z]/g, "_");
    room.timer = room.settings.drawTime;
    broadcastGameState(code);
    const interval = setInterval(() => {
        room.timer--;
        io.to(code).emit('timerUpdate', room.timer);
        if (room.timer <= 0) {
            clearInterval(interval);
            endRound(code, "Time up!");
        }
    }, 1000);
}

function endRound(code, reason) {
    const room = rooms.get(code);
    room.state = 'round-over';
    room.lastRoundData = { word: room.currentWord, players: room.players };
    broadcastGameState(code);
    setTimeout(() => startNextRound(code), 5000);
}

server.listen(PORT, () => console.log(`Picazo running on port ${PORT}`));
