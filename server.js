/**
 * PICAZO - CLIENT LOGIC
 * Handles Socket connection, Drawing, and UI Rendering
 */

const socket = io();

// --- GLOBAL STATE ---
let myPlayerId = null;
let localGameState = {};
let roomCode = '';
let playerIdsInLobby = new Set();

// --- CONSTANTS ---
const QUICK_COLORS = ['#000000', '#FFFFFF', '#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#AF52DE', '#A6814C', '#979797'];
const WORD_PACKS = ["Default", "Animals", "Food", "Hard"];
const AVATARS = [
    '<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#fff0f5"/><g transform="translate(0 5)"><path d="M50 93c-12 0-18-5-18-12V60a2 2 0 012-2h32a2 2 0 012 2v21c0 7-6 12-18 12z" fill="#f472b6" opacity=".8"/><path d="M50 84C66.5 84 80 70.5 80 54V44C80 27.5 66.5 14 50 14S20 27.5 20 44v10c0 16.5 13.5 30 30 30z" fill="#fecaca"/><path d="M25 45 C 15 20, 85 20, 75 45 S 60 70, 50 70 S 40 70, 25 45z" fill="#a16207"/><path d="M70 45 Q 85 60 70 75 L 65 70 Q 75 60 65 45z" fill="#a16207"/><rect x="42" y="52" width="16" height="2" rx="1" fill="#44403c"/><path d="M48 60 a5 3 0 005 3 a5 3 0 005 -3" stroke="#9f1239" fill="none" stroke-width="2" stroke-linecap="round"/></g></svg>',
    '<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#eff6ff"/><g transform="translate(0 5)"><path d="M50 93c-12 0-18-5-18-12V60a2 2 0 012-2h32a2 2 0 012 2v21c0 7-6 12-18 12z" fill="#60a5fa" opacity=".8"/><path d="M50 84C66.5 84 80 70.5 80 54V44C80 27.5 66.5 14 50 14S20 27.5 20 44v10c0 16.5 13.5 30 30 30z" fill="#64748b"/><path d="M50 20 a30 30 0 01-25 25 a 5 5 0 000 10 a30 30 0 0150 0 a 5 5 0 000 -10 a30 30 0 01-25 -25z" fill="#0c0a09"/><path d="M25 45 a25 25 0 0050 0z" fill="#1f2937"/><path d="M38 52 l8 -5 l8 5" stroke="#f1f5f9" stroke-width="2" stroke-linecap="round"/><path d="M50 62 a5 2 0 000 4 a5 2 0 000-4z" fill="#f43f5e"/></g></svg>',
    '<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#f0fdf4"/><g transform="translate(0 5)"><path d="M50 93c-12 0-18-5-18-12V60a2 2 0 012-2h32a2 2 0 012 2v21c0 7-6 12-18 12z" fill="#4ade80" opacity=".8"/><path d="M50 84C66.5 84 80 70.5 80 54V44C80 27.5 66.5 14 50 14S20 27.5 20 44v10c0 16.5 13.5 30 30 30z" fill="#fde68a"/><path d="M20 40 a30 30 0 0160 0 v10 h-60z" fill="#065f46"/><circle cx="35" cy="40" r="10" fill="#065f46"/><circle cx="65" cy="40" r="10" fill="#065f46"/><rect x="44" y="52" width="12" height="12" rx="6" fill="#fff" stroke="#444" stroke-width="1"/><path d="M47 62 a3 2 0 006 0" fill="#e11d48"/></g></svg>',
    '<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#faf5ff"/><g transform="translate(0 5)"><path d="M50 93c-12 0-18-5-18-12V60a2 2 0 012-2h32a2 2 0 012 2v21c0 7-6 12-18 12z" fill="#a855f7" opacity=".8"/><path d="M50 84C66.5 84 80 70.5 80 54V44C80 27.5 66.5 14 50 14S20 27.5 20 44v10c0 16.5 13.5 30 30 30z" fill="#e9d5ff"/><path d="M50 15 c-20 0 -25 20 -25 25 c0 5 5 10 25 10 s 25 -5 25 -10 c0 -5 -5 -25 -25 -25z" fill="#6d28d9"/><path d="M25 40 h50 v5 h-50z" fill="#6d28d9"/><circle cx="40" cy="55" r="4" fill="#a78bfa"/><circle cx="60" cy="55" r="4" fill="#a78bfa"/><circle cx="41" cy="54" r="1" fill="#fff"/><circle cx="61" cy="54" r="1" fill="#fff"/><path d="M48 65 a3 2 0 004 0" stroke="#581c87" stroke-width="1.5" fill="none" stroke-linecap="round"/></g></svg>'
];

// --- SOUNDS ---
const Sound = {
    ctx: null,
    init() { if (this.ctx) return; this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
    play(freq, type, duration, vol) {
        this.init();
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.connect(g); g.connect(this.ctx.destination);
        o.type = type; o.frequency.setValueAtTime(freq, this.ctx.currentTime);
        g.gain.setValueAtTime(vol, this.ctx.currentTime);
        o.start(); g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
        o.stop(this.ctx.currentTime + duration);
    },
    click() { this.play(200, 'triangle', 0.1, 0.1); },
    correct() { this.play(523, 'sine', 0.3, 0.2); },
    start() { this.play(440, 'sine', 0.2, 0.2); }
};

// --- APP MODULE ---
const App = {
    avatarIdx: 0,
    init() {
        this.updateAvatar();
        this.bindEvents();
        this.setupTheme();
        this.setupTools();
        Drawing.init();
    },
    bindEvents() {
        const btnClick = (id, fn) => document.getElementById(id).onclick = () => { Sound.click(); fn(); };
        
        btnClick('prev-avatar', () => { this.avatarIdx = (this.avatarIdx - 1 + AVATARS.length) % AVATARS.length; this.updateAvatar(); });
        btnClick('next-avatar', () => { this.avatarIdx = (this.avatarIdx + 1) % AVATARS.length; this.updateAvatar(); });
        
        btnClick('play-now-btn', () => {
            const name = document.getElementById('player-name-input').value.trim();
            if (!name) return UI.toast('Enter a name!', 'error');
            socket.emit('joinPublicGame', { name, avatar: AVATARS[this.avatarIdx] });
        });

        btnClick('create-private-btn', () => UI.showScreen('private-room-settings'));
        btnClick('pr-back-btn', () => UI.showScreen('main-menu'));
        btnClick('join-private-btn', () => UI.showModal('join-room-modal'));
        btnClick('cancel-join-btn', () => UI.showModal('join-room-modal', false));

        btnClick('confirm-join-btn', () => {
            const name = document.getElementById('player-name-input').value.trim();
            const code = document.getElementById('room-code-input').value.trim().toUpperCase();
            if (!name || code.length !== 4) return UI.toast('Invalid name or code', 'error');
            socket.emit('joinPrivateRoom', { roomCode: code, playerData: { name, avatar: AVATARS[this.avatarIdx] } });
        });

        btnClick('pr-confirm-btn', () => {
            const name = document.getElementById('player-name-input').value.trim();
            if(!name) return UI.toast('Enter name!', 'error');
            const settings = {
                rounds: parseInt(document.getElementById('pr-rounds').value),
                drawTime: parseInt(document.getElementById('pr-drawtime').value),
                wordPack: document.getElementById('pr-word-pack').value,
                customWords: document.getElementById('pr-custom-words').value.split(',').map(w=>w.trim()).filter(Boolean)
            };
            socket.emit('createPrivateRoom', { playerData: { name, avatar: AVATARS[this.avatarIdx] }, settings });
        });

        btnClick('start-game-btn', () => socket.emit('startGame'));
        btnClick('play-again-btn', () => socket.emit('returnToLobby'));
        btnClick('leave-lobby-btn', () => location.reload());

        // Chat
        const sendGuess = () => {
            const input = document.getElementById('chat-input');
            if (input.value.trim()) { socket.emit('submitGuess', input.value.trim()); input.value = ''; }
        };
        document.getElementById('send-guess-btn').onclick = sendGuess;
        document.getElementById('chat-input').onkeydown = (e) => { if(e.key === 'Enter') sendGuess(); };
    },
    updateAvatar() { document.getElementById('avatar-display').innerHTML = AVATARS[this.avatarIdx]; },
    setupTheme() {
        const toggle = document.getElementById('darkModeToggle');
        toggle.onchange = () => document.body.classList.toggle('dark-mode');
    },
    setupTools() {
        const wordPackSelect = document.getElementById('pr-word-pack');
        WORD_PACKS.forEach(p => { const o = document.createElement('option'); o.value = p; o.textContent = p; wordPackSelect.appendChild(o); });

        const palette = document.getElementById('color-palette-popup');
        QUICK_COLORS.forEach(c => {
            const d = document.createElement('div');
            d.className = 'color-option';
            d.style.backgroundColor = c;
            d.onclick = () => { Drawing.color = c; palette.classList.remove('visible'); };
            palette.appendChild(d);
        });
    }
};

// --- RENDERER MODULE ---
const Renderer = {
    render(state, oldState) {
        localGameState = state;
        UI.closeAllModals();
        switch (state.state) {
            case 'waiting': this.lobby(state); break;
            case 'choosing-word':
            case 'playing': this.game(state, oldState); break;
            case 'round-over': this.roundOver(state); break;
            case 'game-over': this.gameOver(state); break;
        }
    },
    lobby(state) {
        UI.showScreen('lobby-screen');
        UI.updatePlayers(state.players, 'lobby-players-list', true);
        const me = state.players.find(p => p.id === socket.id) || {};
        document.getElementById('start-game-btn').style.display = me.isHost ? 'block' : 'none';
        document.getElementById('waiting-for-host-msg').style.display = (!me.isHost && !state.isPublic) ? 'block' : 'none';
    },
    game(state, oldState) {
        UI.showScreen('game-screen');
        if (oldState === 'waiting' || oldState === 'round-over') Drawing.clearCanvas();
        
        const isArtist = state.currentArtistId === socket.id;
        const me = state.players.find(p => p.id === socket.id) || {};
        
        document.getElementById('current-artist-name').textContent = state.players.find(p => p.id === state.currentArtistId)?.name || '...';
        document.getElementById('word-dashes').textContent = state.wordToDisplay.split('').join(' ');
        document.getElementById('word-info').textContent = isArtist ? "Drawing Phase" : `${state.wordLength} Letters`;
        
        UI.updatePlayers(state.players, 'players-list');
        Drawing.canDraw = isArtist && state.state === 'playing';
        document.getElementById('chat-input').disabled = isArtist || me.hasGuessed;
    },
    roundOver(state) {
        UI.showWordOverlay(state.lastRoundData.word);
        setTimeout(() => {
            UI.hideWordOverlay();
            UI.showRoundSummary(state.lastRoundData);
        }, 2000);
    },
    gameOver(state) {
        UI.showFinalScores(state.players, state.lastRoundData.reason);
    }
};

// --- UI HELPERS ---
const UI = {
    showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('visible', s.id === id)); },
    showModal(id, show = true) { document.getElementById(id).classList.toggle('visible', show); },
    closeAllModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('visible')); },
    toast(msg, type) {
        const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = msg;
        document.getElementById('toast-container').appendChild(t); setTimeout(() => t.remove(), 3000);
    },
    updatePlayers(list, elId, isLobby = false) {
        const el = document.getElementById(elId); el.innerHTML = '';
        list.sort((a,b) => b.score - a.score).forEach(p => {
            const r = document.createElement('div'); r.className = `player-row ${p.isArtist?'is-artist':''}`;
            r.innerHTML = `<div class="player-avatar">${p.avatar}</div><span>${p.name} ${p.isHost?'👑':''}</span><b>${p.score}</b>`;
            el.appendChild(r);
        });
    },
    showWordOverlay(word) { const o = document.getElementById('word-reveal-overlay'); o.textContent = word; o.classList.add('visible'); },
    hideWordOverlay() { document.getElementById('word-reveal-overlay').classList.remove('visible'); },
    showRoundSummary(data) {
        const modal = document.getElementById('round-summary-modal');
        document.getElementById('revealed-word').textContent = data.word;
        const list = document.getElementById('summary-player-list'); list.innerHTML = '';
        data.players.forEach(p => {
            const d = document.createElement('div'); d.className = 'summary-row';
            d.innerHTML = `<span>${p.name}</span> <b>+${p.roundPoints || 0}</b>`;
            list.appendChild(d);
        });
        modal.classList.add('visible');
    },
    showFinalScores(players, reason) {
        UI.showScreen('end-game-screen');
        document.getElementById('game-over-reason').textContent = reason;
        const container = document.getElementById('podium-container'); container.innerHTML = '';
        players.sort((a,b)=>b.score-a.score).slice(0,3).forEach((p, i) => {
            const d = document.createElement('div'); d.innerHTML = `<h3>#${i+1} ${p.name}</h3><p>${p.score} pts</p>`;
            container.appendChild(d);
        });
        const me = players.find(p => p.id === socket.id);
        document.getElementById('play-again-popup').classList.toggle('visible', me?.isHost || localGameState.isPublic);
    }
};

// --- DRAWING LOGIC ---
const Drawing = {
    canvas: null, ctx: null, isDrawing: false, canDraw: false,
    color: '#000000', width: 5, tool: 'pencil',
    init() {
        this.canvas = document.getElementById('drawingCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.onresize = () => this.resize();
        
        this.canvas.onpointerdown = (e) => {
            if (!this.canDraw) return;
            this.isDrawing = true;
            this.draw(e, true);
        };
        this.canvas.onpointermove = (e) => this.draw(e);
        this.canvas.onpointerup = () => this.isDrawing = false;
        
        document.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => {
            document.querySelectorAll('[data-tool]').forEach(x => x.classList.remove('active'));
            b.classList.add('active'); this.tool = b.dataset.tool;
        });
        document.getElementById('clear-btn').onclick = () => { if(this.canDraw) socket.emit('clearCanvas'); };
        document.getElementById('undo-btn').onclick = () => { if(this.canDraw) socket.emit('undo'); };
        document.getElementById('brush-size-btn').onclick = () => document.getElementById('brush-size-popup').classList.toggle('visible');
        document.getElementById('color-palette-btn').onclick = () => document.getElementById('color-palette-popup').classList.toggle('visible');
        document.querySelectorAll('.size-option').forEach(o => o.onclick = () => { this.width = o.dataset.size; document.getElementById('brush-size-popup').classList.remove('visible'); });
    },
    resize() {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
    },
    draw(e, isFirst = false) {
        if (!this.isDrawing || !this.canDraw) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const data = { x1: this.lastX || x, y1: this.lastY || y, x2: x, y2: y, color: this.color, width: this.width, tool: this.tool };
        if (!isFirst) {
            socket.emit('drawingAction', data);
            this.drawLine(data);
        }
        this.lastX = x; this.lastY = y;
        if (!this.isDrawing) { this.lastX = null; this.lastY = null; }
    },
    drawLine(d) {
        this.ctx.beginPath();
        this.ctx.globalCompositeOperation = d.tool === 'eraser' ? 'destination-out' : 'source-over';
        this.ctx.strokeStyle = d.color; this.ctx.lineWidth = d.width;
        this.ctx.lineCap = 'round'; this.ctx.lineJoin = 'round';
        this.ctx.moveTo(d.x1, d.y1); this.ctx.lineTo(d.x2, d.y2);
        this.ctx.stroke();
    },
    clearCanvas() { this.ctx.clearRect(0,0,this.canvas.width, this.canvas.height); }
};

// --- SOCKET LISTENERS ---
socket.on('gameStateUpdate', (data) => Renderer.render(data.gameState, localGameState.state));
socket.on('timerUpdate', (t) => document.getElementById('timer-display').textContent = t);
socket.on('drawingAction', (d) => Drawing.drawLine(d));
socket.on('clearCanvas', () => Drawing.clearCanvas());
socket.on('chatMessage', (d) => UI.addChatMessage(d.name, d.message, d.type));
socket.on('correctGuess', (d) => { Sound.correct(); UI.toast(`${d.playerName} guessed correctly!`, 'success'); });
socket.on('chooseWord', (words) => UI.showWordChoiceModal(words, (w) => socket.emit('wordChosen', w)));

document.addEventListener('DOMContentLoaded', () => App.init());
