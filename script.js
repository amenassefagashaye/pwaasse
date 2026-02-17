/* ========================================
   SCRIPT.JS - መርከብ ቢንጎ ጨዋታ PWA
   Insite Digital Group - Ethiopia
   Handles game logic, UI, and PWA features
   ======================================== */

// Immediately Invoked Function Expression for scope isolation
(function() {
    "use strict";

    // ---------- CONSTANTS ----------
    const APP_VERSION = '1.0.0';
    const CACHE_NAME = 'bingo-pwa-v1';
    const BINGO_RANGES = [
        { letter: "B", start: 1, end: 15 },
        { letter: "I", start: 16, end: 30 },
        { letter: "N", start: 31, end: 45 },
        { letter: "G", start: 46, end: 60 },
        { letter: "O", start: 61, end: 75 }
    ];
    const MAX_BOARDS = 300;
    const FREE_SPACE_INDEX = 12;

    // ---------- STATE MANAGEMENT ----------
    let allBoards = [];                 // All available boards (fetched from API/IndexedDB)
    let selectedBoards = [];            // Currently displayed board IDs
    let pendingSelected = new Set();    // Temporary selection set
    let isOffline = !navigator.onLine;  // Track online status

    // DOM Elements cache
    const elements = {
        selectionSection: document.getElementById('selectionSection'),
        bingoSection: document.getElementById('bingoSection'),
        noBoardsSection: document.getElementById('noBoardsSection'),
        boardsContainer: document.getElementById('boardsContainer'),
        footer: document.getElementById('footer'),
        searchInput: document.getElementById('boardSearchInput'),
        addBtn: document.getElementById('addBoardBtn'),
        okBtn: document.getElementById('okBtn'),
        cancelBtn: document.getElementById('cancelBtn'),
        chipsContainer: document.getElementById('selectedChipsContainer'),
        noBoardsSelectBtn: document.getElementById('noBoardsSelectBtn'),
        noBoardsInfoBtn: document.getElementById('noBoardsInfoBtn'),
        infoModal: document.getElementById('infoModal'),
        closeInfoModal: document.getElementById('closeInfoModal'),
        noBoardsStatus: document.getElementById('noBoardsStatus')
    };

    // ---------- INITIALIZATION ----------
    async function initApp() {
        console.log(`Initializing Bingo PWA v${APP_VERSION}`);
        
        // Register service worker
        await registerServiceWorker();
        
        // Load boards from storage
        await loadBoards();
        
        // Set up event listeners
        setupEventListeners();
        
        // Check online status
        setupOnlineDetection();
        
        // Show appropriate view
        showNoBoards();
        
        // Request fullscreen for better PWA experience
        setupFullscreenHandler();
        
        // Log successful initialization
        console.log('App initialized successfully');
    }

    // ---------- SERVICE WORKER REGISTRATION ----------
    async function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/service-worker.js', {
                    scope: '/'
                });
                console.log('ServiceWorker registered:', registration.scope);
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('ServiceWorker update found');
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New version available
                            showUpdateNotification();
                        }
                    });
                });
                
            } catch (error) {
                console.log('ServiceWorker registration failed:', error);
                // Fallback to offline mode
                enableOfflineMode();
            }
        } else {
            console.log('ServiceWorker not supported');
        }
    }

    // ---------- OFFLINE DETECTION ----------
    function setupOnlineDetection() {
        window.addEventListener('online', () => {
            console.log('App is online');
            isOffline = false;
            showConnectionStatus('online');
            syncOfflineData();
        });
        
        window.addEventListener('offline', () => {
            console.log('App is offline');
            isOffline = true;
            showConnectionStatus('offline');
            enableOfflineMode();
        });
    }

    function showConnectionStatus(status) {
        // Show subtle connection status indicator
        const statusEl = document.createElement('div');
        statusEl.className = `connection-status ${status}`;
        statusEl.textContent = status === 'online' ? '🟢 Online' : '🔴 Offline';
        statusEl.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 5px 10px;
            border-radius: 20px;
            background: ${status === 'online' ? '#10b981' : '#ef4444'};
            color: white;
            font-size: 12px;
            z-index: 9999;
            opacity: 0.9;
        `;
        document.body.appendChild(statusEl);
        setTimeout(() => statusEl.remove(), 3000);
    }

    // ---------- BOARD GENERATION (Mock - Replace with API) ----------
    async function loadBoards() {
        try {
            // Try to load from IndexedDB first (offline storage)
            const storedBoards = await loadFromIndexedDB();
            if (storedBoards && storedBoards.length > 0) {
                allBoards = storedBoards;
                return;
            }
            
            // If no stored boards, generate mock data
            // In production: fetch from API with fallback to IndexedDB
            generateMockBoards();
            
            // Store in IndexedDB for offline use
            await saveToIndexedDB(allBoards);
            
        } catch (error) {
            console.error('Failed to load boards:', error);
            generateMockBoards(); // Fallback to mock data
        }
    }

    function generateMockBoards() {
        allBoards = [];
        for (let id = 1; id <= MAX_BOARDS; id++) {
            const board = {
                id,
                numbers: [],
                markedCells: new Set([FREE_SPACE_INDEX]),
                score: 0,
                lastUpdated: Date.now()
            };
            
            // Generate BINGO numbers
            for (let col = 0; col < 5; col++) {
                const range = BINGO_RANGES[col];
                const colNums = [];
                while (colNums.length < 5) {
                    const n = Math.floor(Math.random() * (range.end - range.start + 1)) + range.start;
                    if (!colNums.includes(n)) colNums.push(n);
                }
                colNums.sort((a, b) => a - b);
                for (let row = 0; row < 5; row++) {
                    board.numbers[row * 5 + col] = colNums[row];
                }
            }
            board.numbers[FREE_SPACE_INDEX] = "FREE";
            allBoards.push(board);
        }
    }

    // ---------- INDEXEDDB STORAGE (Offline Support) ----------
    function openIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('BingoDB', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('boards')) {
                    db.createObjectStore('boards', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('gameState')) {
                    db.createObjectStore('gameState', { keyPath: 'id' });
                }
            };
        });
    }

    async function saveToIndexedDB(boards) {
        try {
            const db = await openIndexedDB();
            const tx = db.transaction('boards', 'readwrite');
            const store = tx.objectStore('boards');
            
            boards.forEach(board => {
                // Convert Set to Array for storage
                const boardCopy = {
                    ...board,
                    markedCells: Array.from(board.markedCells)
                };
                store.put(boardCopy);
            });
            
            await tx.complete;
            console.log('Boards saved to IndexedDB');
        } catch (error) {
            console.error('Failed to save to IndexedDB:', error);
        }
    }

    async function loadFromIndexedDB() {
        try {
            const db = await openIndexedDB();
            const tx = db.transaction('boards', 'readonly');
            const store = tx.objectStore('boards');
            const boards = await store.getAll();
            
            // Convert markedCells back to Set
            return boards.map(board => ({
                ...board,
                markedCells: new Set(board.markedCells || [FREE_SPACE_INDEX])
            }));
        } catch (error) {
            console.error('Failed to load from IndexedDB:', error);
            return null;
        }
    }

    // ---------- UI FUNCTIONS ----------
    function setupEventListeners() {
        // Selection section
        elements.searchInput.addEventListener('input', validateInput);
        elements.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addBoard();
        });
        elements.addBtn.addEventListener('click', addBoard);
        elements.okBtn.addEventListener('click', confirmSelection);
        elements.cancelBtn.addEventListener('click', cancelSelection);
        
        // No boards section
        elements.noBoardsSelectBtn.addEventListener('click', openSelectionMode);
        elements.noBoardsInfoBtn.addEventListener('click', showInfoModal);
        
        // Info modal
        elements.closeInfoModal.addEventListener('click', () => {
            elements.infoModal.style.display = 'none';
        });
        window.addEventListener('click', (e) => {
            if (e.target === elements.infoModal) {
                elements.infoModal.style.display = 'none';
            }
        });
    }

    function validateInput() {
        const val = parseInt(elements.searchInput.value, 10);
        if (isNaN(val) || val < 1 || val > MAX_BOARDS) {
            elements.addBtn.disabled = true;
            return false;
        }
        elements.addBtn.disabled = pendingSelected.has(val);
        return !elements.addBtn.disabled;
    }

    function addBoard() {
        const val = parseInt(elements.searchInput.value, 10);
        if (!isNaN(val) && val >= 1 && val <= MAX_BOARDS && !pendingSelected.has(val)) {
            pendingSelected.add(val);
            renderChips();
            elements.searchInput.value = '';
            validateInput();
        }
    }

    function renderChips() {
        elements.chipsContainer.innerHTML = '';
        const sorted = Array.from(pendingSelected).sort((a, b) => a - b);
        
        sorted.forEach(id => {
            const chip = document.createElement('span');
            chip.className = 'chip';
            chip.innerHTML = `#${id} <button class="chip-remove" data-id="${id}" aria-label="Remove board ${id}">✕</button>`;
            
            chip.querySelector('.chip-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                pendingSelected.delete(id);
                renderChips();
                validateInput();
            });
            
            elements.chipsContainer.appendChild(chip);
        });
    }

    function openSelectionMode() {
        pendingSelected = new Set(selectedBoards);
        hideAllSections();
        elements.selectionSection.style.display = 'flex';
        elements.footer.classList.remove('hidden');
        elements.searchInput.value = '';
        elements.addBtn.disabled = true;
        renderChips();
    }

    function confirmSelection() {
        selectedBoards = Array.from(pendingSelected).sort((a, b) => a - b);
        
        if (selectedBoards.length > 0) {
            hideAllSections();
            elements.bingoSection.style.display = 'flex';
            renderAllBoards();
            saveGameState(); // Save for offline
        } else {
            showNoBoards();
        }
    }

    function cancelSelection() {
        if (selectedBoards.length > 0) {
            hideAllSections();
            elements.bingoSection.style.display = 'flex';
            renderAllBoards();
        } else {
            showNoBoards();
        }
    }

    function showNoBoards() {
        hideAllSections();
        elements.noBoardsSection.style.display = 'flex';
        elements.footer.classList.remove('hidden');
        elements.noBoardsStatus.textContent = isOffline ? 
            'Offline - No boards available' : 
            'No boards selected';
    }

    function hideAllSections() {
        elements.selectionSection.style.display = 'none';
        elements.bingoSection.style.display = 'none';
        elements.noBoardsSection.style.display = 'none';
    }

    // ---------- BINGO BOARD FUNCTIONS ----------
    function setLayoutMode() {
        const section = elements.bingoSection;
        section.classList.remove('one-board', 'two-boards', 'three-boards', 'many-boards');
        
        const len = selectedBoards.length;
        if (len === 1) section.classList.add('one-board');
        else if (len === 2) section.classList.add('two-boards');
        else if (len === 3) section.classList.add('three-boards');
        else if (len >= 4) section.classList.add('many-boards');
    }

    function renderAllBoards() {
        elements.boardsContainer.innerHTML = '';
        
        if (selectedBoards.length === 0) {
            showNoBoards();
            return;
        }
        
        setLayoutMode();
        
        selectedBoards.forEach((id, index) => {
            const board = allBoards.find(b => b.id === id);
            if (board) {
                elements.boardsContainer.appendChild(
                    createBoardCard(board, index === 0)
                );
            }
        });
        
        elements.footer.classList.add('hidden');
        requestFullscreen();
    }

    function createBoardCard(board, isFirst) {
        const card = document.createElement('div');
        card.className = 'board-card';
        card.dataset.boardId = board.id;

        // Header
        const header = createBoardHeader(board, isFirst, card);
        card.appendChild(header);

        // Bingo grid
        const grid = createBingoGrid(board, card);
        card.appendChild(grid);

        return card;
    }

    function createBoardHeader(board, isFirst, card) {
        const header = document.createElement('div');
        header.className = 'board-header';

        // Left section
        const leftDiv = document.createElement('div');
        leftDiv.className = 'header-left';
        
        const numCircle = document.createElement('div');
        numCircle.className = 'board-number-circular';
        numCircle.textContent = board.id;
        leftDiv.appendChild(numCircle);

        // Reset button
        const resetBtn = document.createElement('button');
        resetBtn.className = 'header-icon';
        resetBtn.textContent = '↻';
        resetBtn.title = 'Reset board';
        resetBtn.setAttribute('aria-label', `Reset board ${board.id}`);
        resetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            resetBoard(board, card);
        });
        leftDiv.appendChild(resetBtn);

        // Center section
        const centerDiv = document.createElement('div');
        centerDiv.className = 'header-center';
        centerDiv.textContent = 'መርከብ ቢንጎ ጨዋታ';

        // Right section
        const rightDiv = document.createElement('div');
        rightDiv.className = 'header-right';

        if (isFirst) {
            const searchBtn = document.createElement('button');
            searchBtn.className = 'header-icon';
            searchBtn.textContent = '📋';
            searchBtn.title = 'Select boards';
            searchBtn.setAttribute('aria-label', 'Select boards');
            searchBtn.addEventListener('click', (e) => { 
                e.stopPropagation(); 
                openSelectionMode(); 
            });
            rightDiv.appendChild(searchBtn);

            const infoBtn = document.createElement('button');
            infoBtn.className = 'header-icon';
            infoBtn.textContent = 'ℹ️';
            infoBtn.title = 'About Insite Digital Group';
            infoBtn.setAttribute('aria-label', 'About');
            infoBtn.addEventListener('click', (e) => { 
                e.stopPropagation(); 
                showInfoModal(); 
            });
            rightDiv.appendChild(infoBtn);
        }

        const removeBtn = document.createElement('button');
        removeBtn.className = 'header-icon';
        removeBtn.textContent = '🗑️';
        removeBtn.title = 'Remove board';
        removeBtn.setAttribute('aria-label', `Remove board ${board.id}`);
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            card.classList.add('fade-out');
            setTimeout(() => removeBoardById(board.id), 280);
        });
        rightDiv.appendChild(removeBtn);

        header.appendChild(leftDiv);
        header.appendChild(centerDiv);
        header.appendChild(rightDiv);
        
        return header;
    }

    function createBingoGrid(board, card) {
        const bingoBoard = document.createElement('div');
        bingoBoard.className = 'bingo-board';
        
        const grid = document.createElement('div');
        grid.className = 'bingo-grid-unified';

        // Add BINGO letters
        for (let col = 0; col < 5; col++) {
            const cell = document.createElement('div');
            cell.className = 'bingo-letter-cell';
            cell.textContent = BINGO_RANGES[col].letter;
            grid.appendChild(cell);
        }

        // Add number cells
        for (let i = 0; i < 25; i++) {
            const cell = document.createElement('div');
            cell.className = 'bingo-cell';
            const col = i % 5;
            const row = Math.floor(i / 5);
            const letter = BINGO_RANGES[col].letter;

            if (i === FREE_SPACE_INDEX) {
                cell.classList.add('free', 'selected');
                const heartContainer = document.createElement('div');
                heartContainer.className = 'heart-container';
                heartContainer.innerHTML = `
                    <svg class="animated-heart" viewBox="0 0 24 24" width="100%" height="100%">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor"/>
                    </svg>
                `;
                cell.appendChild(heartContainer);
            } else {
                cell.innerHTML = `
                    <div class="cell-number">${board.numbers[i]}</div>
                    <div class="cell-coordinates">${letter}${row + 1}</div>
                `;
                if (board.markedCells.has(i)) {
                    cell.classList.add('selected');
                }
            }

            cell.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleCell(cell, board, i, card);
            });

            grid.appendChild(cell);
        }

        bingoBoard.appendChild(grid);
        return bingoBoard;
    }

    function toggleCell(cell, board, index, card) {
        if (index === FREE_SPACE_INDEX) return; // Free space can't be toggled
        
        cell.classList.toggle('selected');
        
        if (board.markedCells.has(index)) {
            board.markedCells.delete(index);
        } else {
            board.markedCells.add(index);
        }
        
        checkBingo(board, card);
        
        // Debounce save to IndexedDB
        debounce(() => saveGameState(), 500);
    }

    function resetBoard(board, card) {
        board.markedCells.clear();
        board.markedCells.add(FREE_SPACE_INDEX);
        board.score = 0;
        
        // Update UI
        const newCard = createBoardCard(board, false);
        card.replaceWith(newCard);
        
        saveGameState();
    }

    function removeBoardById(id) {
        const index = selectedBoards.indexOf(id);
        if (index > -1) {
            selectedBoards.splice(index, 1);
        }
        
        if (selectedBoards.length === 0) {
            showNoBoards();
            elements.footer.classList.remove('hidden');
            exitFullscreen();
        } else {
            renderAllBoards();
        }
        
        saveGameState();
    }

    // ---------- WIN CHECKING ----------
    function checkBingo(board, card) {
        const marked = board.markedCells;
        
        // All possible winning patterns
        const patterns = [
            // Rows
            [0,1,2,3,4], [5,6,7,8,9], [10,11,12,13,14], 
            [15,16,17,18,19], [20,21,22,23,24],
            // Columns
            [0,5,10,15,20], [1,6,11,16,21], [2,7,12,17,22], 
            [3,8,13,18,23], [4,9,14,19,24],
            // Diagonals
            [0,6,12,18,24], [4,8,12,16,20]
        ];

        const grid = card.querySelector('.bingo-grid-unified');
        if (!grid) return;

        for (let pattern of patterns) {
            if (pattern.every(i => marked.has(i))) {
                // Winning pattern found
                pattern.forEach(i => {
                    const cell = grid.children[i + 5];
                    if (cell) cell.classList.add('winning-cell');
                });
                
                board.score++;
                
                // Remove winning highlight after delay
                setTimeout(() => {
                    pattern.forEach(i => {
                        const cell = grid.children[i + 5];
                        if (cell) cell.classList.remove('winning-cell');
                    });
                }, 2000);
                
                // Only show first winning pattern
                break;
            }
        }
    }

    // ---------- FULLSCREEN HANDLING ----------
    function setupFullscreenHandler() {
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement && selectedBoards.length > 0) {
                // Re-enter fullscreen if boards are active
                requestFullscreen();
            }
        });
    }

    function requestFullscreen() {
        const element = document.documentElement;
        if (element.requestFullscreen) {
            element.requestFullscreen().catch(() => {
                // Ignore errors - may be blocked by browser
            });
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        }
    }

    function exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }

    // ---------- INFO MODAL ----------
    function showInfoModal() {
        elements.infoModal.style.display = 'block';
    }

    // ---------- GAME STATE PERSISTENCE ----------
    async function saveGameState() {
        try {
            const db = await openIndexedDB();
            const tx = db.transaction('gameState', 'readwrite');
            const store = tx.objectStore('gameState');
            
            const state = {
                id: 'current',
                selectedBoards,
                boards: allBoards.map(board => ({
                    ...board,
                    markedCells: Array.from(board.markedCells)
                })),
                timestamp: Date.now()
            };
            
            store.put(state);
            await tx.complete;
            console.log('Game state saved');
        } catch (error) {
            console.error('Failed to save game state:', error);
        }
    }

    async function loadGameState() {
        try {
            const db = await openIndexedDB();
            const tx = db.transaction('gameState', 'readonly');
            const store = tx.objectStore('gameState');
            const state = await store.get('current');
            
            if (state) {
                selectedBoards = state.selectedBoards || [];
                allBoards = state.boards.map(board => ({
                    ...board,
                    markedCells: new Set(board.markedCells || [FREE_SPACE_INDEX])
                }));
                
                if (selectedBoards.length > 0) {
                    hideAllSections();
                    elements.bingoSection.style.display = 'flex';
                    renderAllBoards();
                }
            }
        } catch (error) {
            console.error('Failed to load game state:', error);
        }
    }

    // ---------- UTILITY FUNCTIONS ----------
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function showUpdateNotification() {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            right: 20px;
            background: #1e293b;
            border: 2px solid #fbbf24;
            border-radius: 12px;
            padding: 15px;
            color: white;
            text-align: center;
            z-index: 10000;
            animation: slideUp 0.3s ease;
        `;
        notification.innerHTML = `
            <p style="margin-bottom: 10px;">🔄 New version available!</p>
            <button onclick="location.reload()" style="
                background: #fbbf24;
                border: none;
                padding: 10px 20px;
                border-radius: 8px;
                font-weight: bold;
                cursor: pointer;
            ">Update Now</button>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 10000);
    }

    function enableOfflineMode() {
        console.log('Running in offline mode');
        // Load from IndexedDB if available
        loadGameState();
    }

    function syncOfflineData() {
        console.log('Syncing offline data...');
        // In production: sync with server
        saveGameState();
    }

    // ---------- START THE APP ----------
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }

})();