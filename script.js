/**
 * PICAZO - CLIENT LOGIC
 * Handles Socket connection, Drawing, and UI Rendering
 */

// CHANGE THIS: Use io() for local, or io("https://your-app.onrender.com") for production
const socket = io(); 

// --- GLOBAL STATE ---
let myPlayerId = null;
let localGameState = {};
let roomCode = '';
let playerIdsInLobby = new Set();

// --- CONSTANTS ---
const QUICK_COLORS = ['#000000', '#FFFFFF', '#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#AF52DE', '#A6814C', '#979797'];
const AVATARS = [
    '<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#fff0f5"/><g transform="translate(0 5)"><path d="M50 93c-12 0-18-5-18-12V60a2 2 0 012-2h32a2 2 0 012 2v21c0 7-6 12-18 12z" fill="#f472b6" opacity=".8"/><path d="M50 84C66.5 84 80 70.5 80 54V44C80 27.5 66.5 14 50 14S20 27.5 20 44v10c0 16.5 13.5 30 30 30z" fill="#fecaca"/><path d="M25 45 C 15 20, 85 20, 75 45 S 60 70, 50 70 S 40 70, 25 45z" fill="#a16207"/><path d="M70 45 Q 85 60 70 75 L 65 70 Q 75 60 65 45z" fill="#a16207"/><rect x="42" y="52" width="16" height="2" rx="1" fill="#44403c"/><path d="M48 60 a5 3 0 005 3 a5 3 0 005 -3" stroke="#9f1239" fill="none" stroke-width="2" stroke-linecap="round"/></g></svg>',
    '<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#eff6ff"/><g transform="translate(0 5)"><path d="M50 93c-12 0-18-5-18-12V60a2 2 0 012-2h32a2 2 0 012 2v21c0 7-6 12-18 12z" fill="#60a5fa" opacity=".8"/><path d="M50 84C66.5 84 80 70.5 80 54V44C80 27.5 66.5 14 50 14S20 27.5 20 44v10c0 16.5 13.5 30 30 30z" fill="#64748b"/><path d="M50 20 a30 30 0 01-25 25 a 5 5 0 000 10 a30 30 0 0150 0 a 5 5 0 000 -10 a30 30 0 01-25 -25z" fill="#0c0a09"/><path d="M25 45 a25 25 0 0050 0z" fill="#1f2937"/><path d="M38 52 l8 -5 l8 5" stroke="#f1f5f9" stroke-width="2" stroke-linecap="round"/><path d="M50 62 a5 2 0 000 4 a5 2 0 000-4z" fill="#f43f5e"/></g></svg>',
    '<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#f0fdf4"/><g transform="translate(0 5)"><path d="M50 93c-12 0-18-5-18-12V60a2 2 0 012-2h32a2 2 0 012 2v21c0 7-6 12-18 12z" fill="#4ade80" opacity=".8"/><path d="M50 84C66.5 84 80 70.5 80 54V44C80 27.5 66.5 14 50 14S20 27.5 20 44v10c0 16.5 13.5 30 30 30z" fill="#fde68a"/><path d="M20 40 a30 30 0 0160 0 v10 h-60z" fill="#065f46"/><circle cx="35" cy="40" r="10" fill="#065f46"/><circle cx="65" cy="40" r="10" fill="#065f46"/><rect x="44" y="52" width="12" height="12" rx="6" fill="#fff" stroke="#444" stroke-width="1"/><path d="M47 62 a3 2 0 006 0" fill="#e11d48"/></g></svg>'
];
const WORD_PACKS = ["Default", "Animals", "Food", "Hard"];

// --- SOUND MODULE ---
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
    roundEnd() { this.play(300, 'sawtooth', 0.4, 0.1); }
};

// --- APP CORE ---
const App = {
    avatarIdx: 0,
    init() {
        this.updateAvatar();
        this.bindEvents();
        this.setupUIElements();
        this.setupSocketListeners();
        Drawing.init();
    },
    bindEvents() {
        const listen = (id, fn) => { const el = document.getElementById(id); if(el) el.onclick = () => { Sound.click(); fn(); }; };
        
        listen('prev-avatar', () => { this.avatarIdx = (this.avatarIdx - 1 + AVATARS.length) % AVATARS.length; this.updateAvatar(); });
        listen('next-avatar', () => { this.avatarIdx = (this.avatarIdx + 1) % AVATARS.length; this.updateAvatar(); });
        
        listen('play-now-btn', () => {
            const name = document.getElementById('player-name-input').value.trim();
            if (!name) return UI.toast('Please enter a name!', 'error');
            socket.emit('joinPublicGame', { name, avatar: AVATARS[this.avatarIdx] });
        });

        listen('create-private-btn', () => UI.showScreen('private-room-settings'));
        listen('pr-back-btn', () => UI.showScreen('main-menu'));
        listen('join-private-btn', () => UI.showModal('join-room-modal'));
        listen('cancel-join-btn', () => UI.showModal('join-room-modal', false));

        listen('confirm-join-btn', () => {
            const name = document.getElementById('player-name-input').value.trim();
            const code = document.getElementById('room-code-input').value.trim().toUpperCase();
            if (!name || code.length !== 4) return UI.toast('Valid name and 4-letter code required', 'error');
            socket.emit('joinPrivateRoom', { roomCode: code, playerData: { name, avatar: AVATARS[this.avatarIdx] } });
        });

        listen('pr-confirm-btn', () => {
            const name = document.getElementById('player-name-input').value.trim();
            if(!name) return UI.toast('Name required!', 'error');
            const settings = {
                rounds: parseInt(document.getElementById('pr-rounds').value),
                drawTime: parseInt(document.getElementById('pr-drawtime').value),
                wordPack: document.getElementById('pr-word-pack').value,
                customWords: document.getElementById('pr-custom-words').value.split(',').map(w=>w.trim()).filter(Boolean)
            };
            socket.emit('createPrivateRoom', { playerData: { name, avatar: AVATARS[this.avatarIdx] }, settings });
        });

        listen('start-game-btn', () => socket.emit('startGame'));
        listen('play-again-btn', () => socket.emit('returnToLobby'));
        listen('leave-lobby-btn', () => location.reload());

        // Chat & Guess Logic
        const sendGuess = () => {
            const input = document.getElementById('chat-input');
            if (input.value.trim()) { socket.emit('submitGuess', input.value.trim()); input.value = ''; }
        };
        document.getElementById('send-guess-btn').onclick = sendGuess;
        document.getElementById('chat-input').onkeydown = (e) => { if(e.key === 'Enter') sendGuess(); };

        // Theme Toggle
        document.getElementById('darkModeToggle').onchange = () => document.body.classList.toggle('dark-mode');
    },
    updateAvatar() { document.getElementById('avatar-display').innerHTML = AVATARS[this.avatarIdx]; },
    setupUIElements() {
        const wordPackSelect = document.getElementById('pr-word-pack');
        WORD_PACKS.forEach(p => { const o = document.createElement('option'); o.value = p; o.textContent = p; wordPackSelect.appendChild(o); });

        const palette = document.getElementById('color-palette-popup');
        QUICK_COLORS.forEach(c => {
            const d = document.createElement('div');
            d.className = 'color-option';
            d.style.backgroundColor = c;
            d.style.width = '25px'; d.style.height = '25px'; d.style.borderRadius = '50%'; d.style.cursor = 'pointer';
            d.onclick = () => { Drawing.color = c; palette.classList.remove('visible'); };
            palette.appendChild(d);
        });
    },
    setupSocketListeners() {
        socket.on('connect', () => { myPlayerId = socket.id; });
        socket.on('gameStateUpdate', ({ roomCode: rc, gameState: gs }) => {
            const oldState = localGameState?.state;
            localGameState = gs; roomCode = rc;
            Renderer.render(gs, oldState);
        });
        socket.on('timerUpdate', (t) => {
            const el = document.getElementById('timer-display');
            if(el) { el.textContent = t; el.classList.add('pop'); setTimeout(() => el.classList.remove('pop'), 200); }
        });
        socket.on('drawingAction', (d) => Drawing.drawLine(d));
        socket.on('clearCanvas', () => Drawing.clearCanvas());
        socket.on('undo', () => Drawing.undo());
        socket.on('chatMessage', (d) => UI.addChat(d.name, d.message, d.type));
        socket.on('correctGuess', (d) => { Sound.correct(); UI.toast(`${d.playerName} got it!`, 'success'); });
        socket.on('chooseWord', (words) => UI.showWordChoices(words));
        socket.on('error', (m) => UI.toast(m, 'error'));
    }
};

// --- RENDERER MODULE ---
const Renderer = {
    render(state, oldState) {
        UI.closeModals();
        switch (state.state) {
            case 'waiting': this.renderLobby(state); break;
            case 'choosing-word':
            case 'playing': this.renderGame(state, oldState); break;
            case 'round-over': this.renderRoundOver(state); break;
            case 'game-over': this.renderGameOver(state); break;
        }
    },
    renderLobby(state) {
        UI.showScreen('lobby-screen');
        UI.updatePlayerList(state.players, 'lobby-players-list');
        const me = state.players.find(p => p.id === socket.id) || {};
        document.getElementById('start-game-btn').style.display = me.isHost ? 'block' : 'none';
        document.getElementById('waiting-for-host-msg').style.display = (!me.isHost && !state.isPublic) ? 'block' : 'none';
        const codeEl = document.getElementById('room-code-display');
        if(codeEl) codeEl.innerHTML = state.isPublic ? '<h3>Public Room</h3>' : `<h3>Code: ${roomCode}</h3>`;
    },
    renderGame(state, oldState) {
        UI.showScreen('game-screen');
        if (oldState === 'waiting' || oldState === 'round-over') Drawing.clearCanvas();
        const isArtist = state.currentArtistId === socket.id;
        const me = state.players.find(p => p.id === socket.id) || {};
        
        document.getElementById('current-artist-name').textContent = state.players.find(p => p.id === state.currentArtistId)?.name || '...';
        document.getElementById('word-dashes').textContent = state.wordToDisplay.split('').join(' ');
        document.getElementById('word-info').textContent = isArtist ? "YOU ARE DRAWING" : `${state.wordLength} Letters`;
        document.getElementById('round-info').textContent = `Round ${state.currentRound} of ${state.settings.rounds}`;
        
        UI.updatePlayerList(state.players, 'players-list');
        Drawing.canDraw = (isArtist && state.state === 'playing');
        document.getElementById('chat-input').disabled = (isArtist || me.hasGuessed);
    },
    renderRoundOver(state) {
        Sound.roundEnd();
        UI.showOverlay(state.lastRoundData.word);
        setTimeout(() => { UI.hideOverlay(); UI.showSummary(state.lastRoundData); }, 2000);
    },
    renderGameOver(state) {
        UI.showScreen('end-game-screen');
        document.getElementById('game-over-reason').textContent = state.lastRoundData.reason;
        const cont = document.getElementById('podium-container'); cont.innerHTML = '';
        state.players.sort((a,b)=>b.score-a.score).slice(0,3).forEach((p,i) => {
            cont.innerHTML += `<div class="podium-place"><h2>#${i+1} ${p.name}</h2><p>${p.score} pts</p></div>`;
        });
        const me = state.players.find(p => p.id === socket.id);
        document.getElementById('play-again-popup').classList.toggle('visible', !!(me?.isHost || state.isPublic));
    }
};

// --- UI HELPERS ---
const UI = {
    showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('visible', s.id === id)); },
    showModal(id, show = true) { document.getElementById(id).classList.toggle('visible', show); },
    closeModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('visible')); },
    toast(msg, type) {
        const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = msg;
        document.getElementById('toast-container').appendChild(t); setTimeout(() => t.remove(), 3000);
    },
    updatePlayerList(list, elId) {
        const el = document.getElementById(elId); if(!el) return; el.innerHTML = '';
        list.sort((a,b) => b.score - a.score).forEach(p => {
            el.innerHTML += `<div class="player-row ${p.isArtist?'is-artist':''}">
                <div class="player-avatar">${p.avatar}</div>
                <div class="player-info"><span>${p.name}${p.isHost?' 👑':''}${p.hasGuessed?' ✔️':''}</span><b>${p.score}</b></div>
            </div>`;
        });
    },
    addChat(name, msg, type) {
        const m = document.getElementById('chat-messages'); if(!m) return;
        const d = document.createElement('div'); d.className = `message ${type}`;
        d.innerHTML = name ? `<b>${name}:</b> ${msg}` : `<i>${msg}</i>`;
        m.appendChild(d); m.scrollTop = m.scrollHeight;
    },
    showWordChoices(words) {
        const c = document.getElementById('word-choice-container'); c.innerHTML = '';
        words.forEach(w => {
            const b = document.createElement('button'); b.className = 'btn'; b.textContent = w;
            b.onclick = () => { socket.emit('wordChosen', w); UI.showModal('word-choice-modal', false); };
            c.appendChild(b);
        });
        UI.showModal('word-choice-modal');
    },
    showOverlay(word) { const o = document.getElementById('word-reveal-overlay'); o.textContent = word.toUpperCase(); o.classList.add('visible'); },
    hideOverlay() { document.getElementById('word-reveal-overlay').classList.remove('visible'); },
    showSummary(data) {
        document.getElementById('revealed-word').textContent = data.word.toUpperCase();
        const l = document.getElementById('summary-player-list'); l.innerHTML = '';
        data.players.sort((a,b)=>b.roundPoints - a.roundPoints).forEach(p => {
            l.innerHTML += `<div class="player-row"><span>${p.name}</span><b>+${p.roundPoints || 0}</b></div>`;
        });
        UI.showModal('round-summary-modal');
    }
};

// --- DRAWING MODULE ---
const Drawing = {
    canvas: null, ctx: null, isDrawing: false, canDraw: false,
    color: '#000000', width: 5, tool: 'pencil', history: [],
    init() {
        this.canvas = document.getElementById('drawingCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize(); window.onresize = () => this.resize();
        
        this.canvas.onpointerdown = (e) => { if (!this.canDraw) return; this.isDrawing = true; this.save(); this.draw(e, true); };
        this.canvas.onpointermove = (e) => this.draw(e);
        this.canvas.onpointerup = () => { this.isDrawing = false; this.save(); };

        document.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => {
            document.querySelectorAll('[data-tool]').forEach(x => x.classList.remove('active'));
            b.classList.add('active'); this.tool = b.dataset.tool;
        });
        document.getElementById('brush-size-btn').onclick = () => document.getElementById('brush-size-popup').classList.toggle('visible');
        document.getElementById('color-palette-btn').onclick = () => document.getElementById('color-palette-popup').classList.toggle('visible');
        document.getElementById('clear-btn').onclick = () => { if(this.canDraw) socket.emit('clearCanvas'); };
        document.getElementById('undo-btn').onclick = () => { if(this.canDraw) socket.emit('undo'); };
        document.querySelectorAll('.size-option').forEach(o => o.onclick = () => { this.width = o.dataset.size; document.getElementById('brush-size-popup').classList.remove('visible'); });
    },
    resize() { const p = this.canvas.parentElement; this.canvas.width = p.clientWidth; this.canvas.height = p.clientHeight; if(this.history.length) this.undo(); },
    save() { if(this.history.length > 20) this.history.shift(); this.history.push(this.canvas.toDataURL()); },
    draw(e, first = false) {
        if (!this.isDrawing || !this.canDraw) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left, y = e.clientY - rect.top;
        const data = { x1: this.lastX || x, y1: this.lastY || y, x2: x, y2: y, color: this.color, width: this.width, tool: this.tool };
        if (!first) { socket.emit('drawingAction', data); this.drawLine(data); }
        this.lastX = x; this.lastY = y;
        if (!this.isDrawing) { this.lastX = null; this.lastY = null; }
    },
    drawLine(d) {
        this.ctx.beginPath(); this.ctx.globalCompositeOperation = d.tool === 'eraser' ? 'destination-out' : 'source-over';
        this.ctx.strokeStyle = d.color; this.ctx.lineWidth = d.width; this.ctx.lineCap = 'round'; this.ctx.lineJoin = 'round';
        this.ctx.moveTo(d.x1, d.y1); this.ctx.lineTo(d.x2, d.y2); this.ctx.stroke();
    },
    clearCanvas() { this.ctx.clearRect(0,0,this.canvas.width, this.canvas.height); this.history = []; },
    undo() {
        if(this.history.length < 1) return this.clearCanvas();
        const img = new Image(); img.src = this.history.pop();
        img.onload = () => { this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height); this.ctx.drawImage(img,0,0); };
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
