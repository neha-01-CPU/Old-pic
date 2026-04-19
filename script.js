/**
 * PICAZO - FRONTEND PREVIEW MODE
 * All Socket.io dependencies removed for Vercel Static Deployment.
 * Real-time features are simulated for design/layout testing.
 */

const App = {
    avatarIdx: 0,
    currentTheme: 'light',
    
    // SVG Avatars for preview
    avatars: [
        '<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#fff0f5"/><path d="M50 84C66.5 84 80 70.5 80 54V44C80 27.5 66.5 14 50 14S20 27.5 20 44v10c0 16.5 13.5 30 30 30z" fill="#fecaca"/><circle cx="35" cy="45" r="4" fill="#333"/><circle cx="65" cy="45" r="4" fill="#333"/><path d="M40 65 Q 50 75 60 65" stroke="#9f1239" fill="none" stroke-width="3" stroke-linecap="round"/></svg>',
        '<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#eff6ff"/><path d="M50 84C66.5 84 80 70.5 80 54V44C80 27.5 66.5 14 50 14S20 27.5 20 44v10c0 16.5 13.5 30 30 30z" fill="#64748b"/><circle cx="35" cy="45" r="4" fill="#fff"/><circle cx="65" cy="45" r="4" fill="#fff"/><path d="M40 65 Q 50 75 60 65" stroke="#f43f5e" fill="none" stroke-width="3" stroke-linecap="round"/></svg>',
        '<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#f0fdf4"/><path d="M50 84C66.5 84 80 70.5 80 54V44C80 27.5 66.5 14 50 14S20 27.5 20 44v10c0 16.5 13.5 30 30 30z" fill="#fde68a"/><circle cx="35" cy="45" r="4" fill="#333"/><circle cx="65" cy="45" r="4" fill="#333"/><path d="M40 65 Q 50 75 60 65" stroke="#065f46" fill="none" stroke-width="3" stroke-linecap="round"/></svg>'
    ],

    init() {
        this.bindEvents();
        this.updateAvatar();
        this.populateColors();
        Drawing.init();
        console.log("Picazo: Frontend Preview Mode Active.");
    },

    bindEvents() {
        // Navigation Logic
        document.getElementById('play-now-btn').onclick = () => this.showScreen('lobby-screen');
        document.getElementById('create-private-btn').onclick = () => this.showScreen('private-room-settings');
        document.getElementById('pr-back-btn').onclick = () => this.showScreen('main-menu');
        document.getElementById('pr-confirm-btn').onclick = () => this.showScreen('lobby-screen');
        document.getElementById('leave-lobby-btn').onclick = () => this.showScreen('main-menu');
        document.getElementById('start-game-btn').onclick = () => {
            this.showScreen('game-screen');
            Drawing.resize(); // Ensure canvas matches new visible container
        };

        // Avatar Logic
        document.getElementById('prev-avatar').onclick = () => {
            this.avatarIdx = (this.avatarIdx - 1 + this.avatars.length) % this.avatars.length;
            this.updateAvatar();
        };
        document.getElementById('next-avatar').onclick = () => {
            this.avatarIdx = (this.avatarIdx + 1) % this.avatars.length;
            this.updateAvatar();
        };

        // Theme Toggle
        document.getElementById('darkModeToggle').onchange = (e) => {
            document.body.classList.toggle('dark-mode', e.target.checked);
        };

        // Range Input Sync
        document.querySelectorAll('input[type="range"]').forEach(slider => {
            slider.oninput = (e) => {
                const badge = document.querySelector(`.value-badge[data-for="${e.target.id}"]`);
                if (badge) badge.textContent = e.target.id.includes('time') ? `${e.target.value}s` : e.target.value;
            };
        });
    },

    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('visible'));
        document.getElementById(id).classList.add('visible');
    },

    updateAvatar() {
        const html = this.avatars[this.avatarIdx];
        document.getElementById('avatar-display').innerHTML = html;
        document.getElementById('lobby-me-avatar').innerHTML = html;
        document.getElementById('game-me-avatar').innerHTML = html;
    },

    populateColors() {
        const colors = ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500'];
        const container = document.getElementById('color-palette-popup');
        colors.forEach(c => {
            const div = document.createElement('div');
            div.className = 'color-option';
            div.style.background = c;
            div.style.width = '30px';
            div.style.height = '30px';
            div.onclick = () => {
                Drawing.color = c;
                container.classList.remove('visible');
            };
            container.appendChild(div);
        });
    }
};

const Drawing = {
    canvas: null,
    ctx: null,
    isDrawing: false,
    color: '#000000',
    width: 5,
    tool: 'pencil',
    history: [],

    init() {
        this.canvas = document.getElementById('drawingCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        
        // Mouse/Touch Events
        this.canvas.onpointerdown = (e) => this.start(e);
        this.canvas.onpointermove = (e) => this.draw(e);
        this.canvas.onpointerup = () => this.stop();
        
        // Tool Controls
        document.getElementById('brush-size-btn').onclick = () => {
            document.getElementById('brush-size-popup').classList.toggle('visible');
        };
        document.getElementById('color-palette-btn').onclick = () => {
            document.getElementById('color-palette-popup').classList.toggle('visible');
        };
        document.getElementById('clear-btn').onclick = () => this.clear();
        document.getElementById('undo-btn').onclick = () => this.undo();
        
        document.querySelectorAll('[data-tool]').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.tool = btn.dataset.tool;
            };
        });

        document.querySelectorAll('.size-option').forEach(opt => {
            opt.onclick = () => {
                this.width = opt.dataset.size;
                document.getElementById('brush-size-popup').classList.remove('visible');
            };
        });
    },

    resize() {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
        this.redraw();
    },

    start(e) {
        this.isDrawing = true;
        this.ctx.beginPath();
        this.ctx.moveTo(e.offsetX, e.offsetY);
        this.saveState();
    },

    draw(e) {
        if (!this.isDrawing) return;
        this.ctx.lineWidth = this.width;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.globalCompositeOperation = this.tool === 'eraser' ? 'destination-out' : 'source-over';
        this.ctx.strokeStyle = this.color;
        
        this.ctx.lineTo(e.offsetX, e.offsetY);
        this.ctx.stroke();
    },

    stop() {
        this.isDrawing = false;
    },

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.history = [];
    },

    saveState() {
        if (this.history.length > 20) this.history.shift();
        this.history.push(this.canvas.toDataURL());
    },

    undo() {
        if (this.history.length === 0) return;
        const last = this.history.pop();
        const img = new Image();
        img.src = last;
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(img, 0, 0);
        };
    },

    redraw() {
        if (this.history.length > 0) {
            const img = new Image();
            img.src = this.history[this.history.length - 1];
            img.onload = () => this.ctx.drawImage(img, 0, 0);
        }
    }
};

window.onload = () => App.init();
