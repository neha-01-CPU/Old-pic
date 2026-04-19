/**
 * PICAZO - FRONTEND SANDBOX ENGINE
 * logic for navigation, drawing, and UI feedback.
 */

const App = {
    avatarIdx: 0,
    // Using high-quality SVGs for the preview
    avatars: [
        '<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#fff0f5"/><path d="M50 84C66.5 84 80 70.5 80 54V44C80 27.5 66.5 14 50 14S20 27.5 20 44v10c0 16.5 13.5 30 30 30z" fill="#fecaca"/><circle cx="35" cy="45" r="4" fill="#333"/><circle cx="65" cy="45" r="4" fill="#333"/><path d="M40 65 Q 50 75 60 65" stroke="#9f1239" fill="none" stroke-width="3" stroke-linecap="round"/></svg>',
        '<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#eff6ff"/><path d="M50 84C66.5 84 80 70.5 80 54V44C80 27.5 66.5 14 50 14S20 27.5 20 44v10c0 16.5 13.5 30 30 30z" fill="#64748b"/><circle cx="35" cy="45" r="4" fill="#fff"/><circle cx="65" cy="45" r="4" fill="#fff"/><path d="M40 65 Q 50 75 60 65" stroke="#f43f5e" fill="none" stroke-width="3" stroke-linecap="round"/></svg>',
        '<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#f0fdf4"/><path d="M50 84C66.5 84 80 70.5 80 54V44C80 27.5 66.5 14 50 14S20 27.5 20 44v10c0 16.5 13.5 30 30 30z" fill="#fde68a"/><circle cx="35" cy="45" r="4" fill="#333"/><circle cx="65" cy="45" r="4" fill="#333"/><path d="M40 65 Q 50 75 60 65" stroke="#065f46" fill="none" stroke-width="3" stroke-linecap="round"/></svg>'
    ],

    init() {
        this.bindNavigation();
        this.bindAvatarPicker();
        this.bindThemeToggle();
        this.populateColorPalette();
        Drawing.init();
        this.updateAvatar();
        console.log("Picazo Frontend initialized in Sandbox mode.");
    },

    // Handle screen transitions
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('visible'));
        const target = document.getElementById(screenId);
        if (target) target.classList.add('visible');
    },

    bindNavigation() {
        // Menu Buttons
        document.getElementById('play-now-btn').onclick = () => {
            const name = document.getElementById('player-name-input').value.trim();
            if (!name) {
                this.showToast("Please enter a name first!", "error");
                return;
            }
            this.showScreen('lobby-screen');
        };

        document.getElementById('create-private-btn').onclick = () => this.showScreen('private-room-settings');
        
        // Settings Buttons
        document.getElementById('pr-back-btn').onclick = () => this.showScreen('main-menu');
        document.getElementById('pr-confirm-btn').onclick = () => this.showScreen('lobby-screen');

        // Lobby Buttons
        document.getElementById('leave-lobby-btn').onclick = () => this.showScreen('main-menu');
        document.getElementById('start-game-btn').onclick = () => {
            this.showScreen('game-screen');
            Drawing.resizeCanvas(); // Ensure canvas is ready
        };

        // UI Range Sliders Sync
        document.querySelectorAll('input[type="range"]').forEach(slider => {
            slider.oninput = (e) => {
                const badge = document.querySelector(`.value-badge[data-for="${e.target.id}"]`);
                if (badge) badge.textContent = e.target.id === 'pr-drawtime' ? `${e.target.value}s` : e.target.value;
            };
        });
    },

    bindAvatarPicker() {
        document.getElementById('prev-avatar').onclick = () => {
            this.avatarIdx = (this.avatarIdx - 1 + this.avatars.length) % this.avatars.length;
            this.updateAvatar();
        };
        document.getElementById('next-avatar').onclick = () => {
            this.avatarIdx = (this.avatarIdx + 1) % this.avatars.length;
            this.updateAvatar();
        };
    },

    updateAvatar() {
        const svg = this.avatars[this.avatarIdx];
        document.getElementById('avatar-display').innerHTML = svg;
        document.getElementById('lobby-me-avatar').innerHTML = svg;
        document.getElementById('game-me-avatar').innerHTML = svg;
    },

    bindThemeToggle() {
        document.getElementById('darkModeToggle').onchange = (e) => {
            document.body.classList.toggle('dark-mode', e.target.checked);
        };
    },

    populateColorPalette() {
        const colors = ['#000000', '#ffffff', '#ff4757', '#2ed573', '#1e90ff', '#ffa502', '#8e44ad', '#f1c40f'];
        const container = document.getElementById('color-palette-popup');
        colors.forEach(color => {
            const div = document.createElement('div');
            div.className = 'color-option';
            div.style.backgroundColor = color;
            div.style.width = '25px';
            div.style.height = '25px';
            div.style.borderRadius = '50%';
            div.style.cursor = 'pointer';
            div.style.border = '1px solid #ddd';
            div.onclick = () => {
                Drawing.color = color;
                container.classList.remove('visible');
            };
            container.appendChild(div);
        });
    },

    showToast(msg, type) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = msg;
        // Simple manual styling for toasts
        toast.style.padding = "10px 20px";
        toast.style.background = type === 'error' ? '#ff4757' : '#2ed573';
        toast.style.color = "white";
        toast.style.borderRadius = "8px";
        toast.style.marginBottom = "10px";
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
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
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Drawing Events
        this.canvas.addEventListener('pointerdown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('pointermove', (e) => this.draw(e));
        this.canvas.addEventListener('pointerup', () => this.stopDrawing());
        this.canvas.addEventListener('pointercancel', () => this.stopDrawing());

        // Tool Controls
        document.querySelectorAll('[data-tool]').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.tool = btn.dataset.tool;
            };
        });

        document.getElementById('brush-size-btn').onclick = () => {
            document.getElementById('brush-size-popup').classList.toggle('visible');
        };
        document.getElementById('color-palette-btn').onclick = () => {
            document.getElementById('color-palette-popup').classList.toggle('visible');
        };
        
        document.querySelectorAll('.size-option').forEach(opt => {
            opt.onclick = () => {
                this.width = opt.dataset.size;
                document.getElementById('brush-size-popup').classList.remove('visible');
            };
        });

        document.getElementById('clear-btn').onclick = () => this.clear();
        document.getElementById('undo-btn').onclick = () => this.undo();
    },

    resizeCanvas() {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
        this.redraw();
    },

    startDrawing(e) {
        this.isDrawing = true;
        this.saveState();
        this.ctx.beginPath();
        this.ctx.moveTo(e.offsetX, e.offsetY);
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

    stopDrawing() {
        this.isDrawing = false;
        this.ctx.closePath();
    },

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.history = [];
    },

    saveState() {
        if (this.history.length > 25) this.history.shift();
        this.history.push(this.canvas.toDataURL());
    },

    undo() {
        if (this.history.length === 0) return;
        const lastAction = this.history.pop();
        const img = new Image();
        img.src = lastAction;
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

// Start the engine
window.onload = () => App.init();
