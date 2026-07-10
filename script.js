// Global state
let appState = {
  boards: [],
  cards: [],
  projects: [],
  people: [],
  relationships: [],
  currentBoardId: null,
  filters: {
    search: '',
    assignee: '',
    priority: '',
    project: '',
    status: '',
    tags: []
  },
  selectedCardId: null,
  draggedCardId: null
};

const COLUMNS = ['TODO', 'In Progress', 'Done'];
const STORAGE_KEY = 'kanban-app-state';

// ============================================================================
// Data Loading & Persistence
// ============================================================================

async function loadData() {
  try {
    // Try loading from localStorage first
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      appState = JSON.parse(stored);
      console.log('Loaded from localStorage');
    } else {
      // Load from data.json
      const response = await fetch('data.json');
      const data = await response.json();
      appState.boards = data.boards;
      appState.cards = data.cards;
      appState.projects = data.projects;
      appState.people = data.people;
      appState.relationships = data.relationships;
      saveToLocalStorage();
      console.log('Loaded from data.json');
    }

    // Auto-select first board
    if (appState.boards.length > 0 && !appState.currentBoardId) {
      appState.currentBoardId = appState.boards[0].id;
    }

    renderUI();
  } catch (error) {
    console.error('Error loading data:', error);
    showToast('Error loading data', 'error');
  }
}

function saveToLocalStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  console.log('Saved to localStorage');
}

function exportJSON() {
  const dataStr = JSON.stringify(appState, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `kanban-export-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('Data exported successfully');
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      appState.boards = imported.boards || appState.boards;
      appState.cards = imported.cards || appState.cards;
      appState.projects = imported.projects || appState.projects;
      appState.people = imported.people || appState.people;
      appState.relationships = imported.relationships || appState.relationships;
      appState.currentBoardId = appState.boards[0]?.id || null;
      appState.filters = { search: '', assignee: '', priority: '', project: '', status: '', tags: [] };
      saveToLocalStorage();
      renderUI();
      showToast('Data imported successfully');
    } catch (error) {
      console.error('Error importing JSON:', error);
      showToast('Error importing JSON', 'error');
    }
  };
  reader.readAsText(file);
}

// ============================================================================
// UI Rendering
// ============================================================================

function renderUI() {
  renderBoards();
  renderCurrentBoard();
  populateFilterDropdowns();
}

function renderBoards() {
  const boardList = document.getElementById('boardList');
  boardList.innerHTML = '';

  appState.boards.forEach(board => {
    const isActive = board.id === appState.currentBoardId;
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between';

    const btn = document.createElement('button');
    btn.className = `w-full text-left px-3 py-2 rounded-lg transition ${
      isActive
        ? 'bg-blue-500 text-white'
        : 'text-gray-700 hover:bg-gray-100'
    }`;
    btn.innerHTML = `
      <div class="font-medium">${escapeHtml(board.name)}</div>
      <div class="text-xs ${isActive ? 'text-blue-100' : 'text-gray-500'}">${appState.cards.filter(c => c.board_id === board.id).length} cards</div>
    `;
    btn.addEventListener('click', () => selectBoard(board.id));

    const closeBtn = document.createElement('button');
    closeBtn.className = 'ml-2 text-sm text-red-600 hover:text-red-800 px-2 py-1 rounded';
    closeBtn.title = 'Close board';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Close board "${board.name}"? This will delete the board and its cards.`)) {
        closeBoard(board.id);
      }
    });

    item.appendChild(btn);
    item.appendChild(closeBtn);
    boardList.appendChild(item);
  });
}

function closeBoard(boardId) {
  // Remove cards and relationships belonging to this board
  appState.cards = appState.cards.filter(c => c.board_id !== boardId);
  appState.relationships = appState.relationships.filter(r => {
    const existsBlocker = appState.cards.some(c => c.id === r.blocker_id);
    const existsBlocked = appState.cards.some(c => c.id === r.blocked_id);
    return existsBlocker && existsBlocked;
  });

  // Remove the board
  appState.boards = appState.boards.filter(b => b.id !== boardId);

  // Adjust currentBoardId
  if (appState.currentBoardId === boardId) {
    appState.currentBoardId = appState.boards[0]?.id || null;
  }

  saveToLocalStorage();
  renderUI();
  showToast('Board closed');
}

function selectBoard(boardId) {
  appState.currentBoardId = boardId;
  appState.filters = { search: '', assignee: '', priority: '', project: '', status: '', tags: [] };
  document.getElementById('searchInput').value = '';
  document.getElementById('filterPanel').classList.add('hidden');
  renderUI();
}

function renderCurrentBoard() {
  const board = appState.boards.find(b => b.id === appState.currentBoardId);
  if (!board) return;

  document.getElementById('currentBoardTitle').textContent = board.name;
  document.getElementById('currentBoardDesc').textContent = board.description;

  const columnsContainer = document.getElementById('boardColumns');
  columnsContainer.innerHTML = '';

  const columns = Array.isArray(board.columns) && board.columns.length > 0 ? board.columns : COLUMNS;
  columns.forEach(column => {
    const columnDiv = document.createElement('div');
    columnDiv.className = 'flex-shrink-0 w-80 bg-gray-200 rounded-lg p-4 column-droppable transition';
    columnDiv.dataset.column = column;
    columnDiv.addEventListener('dragover', handleDragOver);
    columnDiv.addEventListener('drop', (e) => handleDrop(e, column));

    const headerDiv = document.createElement('div');
    headerDiv.className = 'flex items-center justify-between mb-4';

    const titleEl = document.createElement('h3');
    titleEl.className = 'font-bold text-gray-900';
    titleEl.textContent = column;
    headerDiv.appendChild(titleEl);

    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'flex items-center gap-1';

    const colIndex = columns.indexOf(column);
    
    // Left arrow button (move column left)
    if (colIndex > 0) {
      const moveLeftBtn = document.createElement('button');
      moveLeftBtn.className = 'text-xs text-gray-600 hover:text-gray-900 px-1 py-1 rounded';
      moveLeftBtn.title = 'Move column left';
      moveLeftBtn.innerHTML = '←';
      moveLeftBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        moveColumn(column, 'left');
      });
      controlsDiv.appendChild(moveLeftBtn);
    }

    // Right arrow button (move column right)
    if (colIndex < columns.length - 1) {
      const moveRightBtn = document.createElement('button');
      moveRightBtn.className = 'text-xs text-gray-600 hover:text-gray-900 px-1 py-1 rounded';
      moveRightBtn.title = 'Move column right';
      moveRightBtn.innerHTML = '→';
      moveRightBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        moveColumn(column, 'right');
      });
      controlsDiv.appendChild(moveRightBtn);
    }

    const delColBtn = document.createElement('button');
    delColBtn.className = 'text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded';
    delColBtn.title = 'Delete column';
    delColBtn.innerHTML = '&times;';
    delColBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!confirm(`Delete column "${column}"? Cards in this column will be moved to the first column.`)) return;
      removeColumn(column);
    });

    controlsDiv.appendChild(delColBtn);
    headerDiv.appendChild(controlsDiv);
    columnDiv.appendChild(headerDiv);

    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'space-y-3';
    const safeId = column.replace(/\s+/g, '-');
    cardsContainer.id = `column-${safeId}`;

    const filteredCards = getFilteredCards(column);
    filteredCards.forEach(card => {
      const cardEl = createCardElement(card);
      cardsContainer.appendChild(cardEl);
    });

    const addCardBtn = document.createElement('button');
    addCardBtn.className = 'w-full px-3 py-2 border-2 border-dashed border-gray-400 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-500 transition text-sm font-medium';
    addCardBtn.textContent = '+ Add Card';
    addCardBtn.addEventListener('click', () => openNewCardModal(column));
    cardsContainer.appendChild(addCardBtn);

    columnDiv.appendChild(cardsContainer);
    columnsContainer.appendChild(columnDiv);
  });
}

function createCardElement(card) {
  const cardEl = document.createElement('div');
  cardEl.className = 'card bg-white rounded-lg shadow p-3 cursor-move hover:shadow-lg transition';
  cardEl.draggable = true;
  cardEl.dataset.cardId = card.id;

  if (isDueDate(card.due_date).overdue) {
    cardEl.classList.add('overdue');
  } else if (isDueDate(card.due_date).duesSoon) {
    cardEl.classList.add('due-soon');
  }

  // support multiple assignees (backwards compatible with assignee_id)
  const assigneeIds = card.assignees || (card.assignee_id ? [card.assignee_id] : []);
  const assignees = assigneeIds.map(id => appState.people.find(p => p.id === id)).filter(Boolean);
  const project = appState.projects.find(p => p.id === card.project_id);

  let blockingInfo = '';
  const blockingRels = appState.relationships.filter(r => r.blocker_id === card.id);
  const blockedByRels = appState.relationships.filter(r => r.blocked_id === card.id);
  if (blockingRels.length > 0 || blockedByRels.length > 0) {
    blockingInfo = `<div class="mt-2 text-xs text-red-700">🔗 ${blockingRels.length + blockedByRels.length} relationship(s)</div>`;
  }

  cardEl.innerHTML = `
    <div class="flex items-start justify-between mb-2">
      <h4 class="font-semibold text-gray-900 text-sm flex-1 truncate">${escapeHtml(card.title)}</h4>
      <span class="priority-${card.priority} tag ml-2 flex-shrink-0">${card.priority}</span>
    </div>
    ${card.description ? `<p class="text-xs text-gray-600 mb-2 truncate-lines">${escapeHtml(card.description)}</p>` : ''}
    <div class="flex flex-wrap gap-1 mb-2">
      ${card.tags.map(tag => `<span class="tag bg-blue-100 text-blue-800">${escapeHtml(tag)}</span>`).join('')}
      ${project ? `<span class="tag bg-purple-100 text-purple-800">${escapeHtml(project.name)}</span>` : ''}
    </div>
    ${blockingInfo}
    <div class="flex items-center justify-between mt-3 pt-2 border-t border-gray-200">
      <div class="flex items-center gap-2">
        ${assignees.length > 0 ? assignees.map(a => `<div class="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold" title="${a.name}">${a.initials}</div>`).join('') : '<div class="w-6 h-6 bg-gray-300 rounded-full"></div>'}
        ${card.due_date ? `<span class="text-xs text-gray-500">${formatDate(card.due_date)}</span>` : ''}
      </div>
    </div>
  `;

  cardEl.addEventListener('dragstart', (e) => {
    appState.draggedCardId = card.id;
    cardEl.classList.add('card-dragging');
  });
  cardEl.addEventListener('dragend', () => {
    cardEl.classList.remove('card-dragging');
    appState.draggedCardId = null;
  });
  cardEl.addEventListener('click', () => openCardDetailModal(card.id));

  return cardEl;
}

// ============================================================================
// Filtering & Search
// ============================================================================

function getFilteredCards(column) {
  const board = appState.boards.find(b => b.id === appState.currentBoardId);
  if (!board) return [];

  return appState.cards
    .filter(card => {
      // Filter by board and column
      const status = getCardStatus(card);
      return card.board_id === board.id && status === column;
    })
    .filter(card => {
      // Apply search filter
      if (appState.filters.search) {
        const search = appState.filters.search.toLowerCase();
        return (
          card.title.toLowerCase().includes(search) ||
          card.description.toLowerCase().includes(search)
        );
      }
      return true;
    })
    .filter(card => {
      // Apply assignee filter
      if (appState.filters.assignee) {
        const ids = card.assignees || (card.assignee_id ? [card.assignee_id] : []);
        return ids.includes(appState.filters.assignee);
      }
      return true;
    })
    .filter(card => {
      // Apply priority filter
      if (appState.filters.priority) {
        return card.priority === appState.filters.priority;
      }
      return true;
    })
    .filter(card => {
      // Apply project filter
      if (appState.filters.project) {
        return card.project_id === appState.filters.project;
      }
      return true;
    })
    .filter(card => {
      // Apply tags filter
      if (appState.filters.tags.length > 0) {
        return appState.filters.tags.some(tag => card.tags.includes(tag));
      }
      return true;
    })
    .filter(card => {
      // Apply status filter (due date)
      if (appState.filters.status === 'overdue') {
        return isDueDate(card.due_date).overdue;
      } else if (appState.filters.status === 'due-soon') {
        return isDueDate(card.due_date).duesSoon;
      } else if (appState.filters.status === 'no-due') {
        return !card.due_date;
      }
      return true;
    })
    .sort((a, b) => a.position - b.position);
}

function getCardStatus(card) {
  return card.status || 'TODO';
}

// ============================================================================
// Card Operations
// ============================================================================

function createNewCard(column) {
  const title = document.getElementById('newCardTitle').value.trim();
  if (!title) {
    showToast('Please enter a card title', 'warn');
    return;
  }

  const card = {
    id: 'card-' + Date.now(),
    title,
    description: document.getElementById('newCardDesc').value.trim(),
    board_id: appState.currentBoardId,
    // support multiple assignees
    assignees: Array.from(document.getElementById('newCardAssignee').selectedOptions).map(o => o.value).filter(v => v),
    tags: document.getElementById('newCardTags').value.split(',').map(t => t.trim()).filter(t => t),
    priority: document.getElementById('newCardPriority').value,
    due_date: document.getElementById('newCardDueDate').value || null,
    project_id: document.getElementById('newCardProject').value || null,
    position: appState.cards.filter(c => c.board_id === appState.currentBoardId).length,
    comments: []
  };

  appState.cards.push(card);
  saveToLocalStorage();
  closeNewCardModal();
  renderCurrentBoard();
  showToast('Card created successfully');
}

function updateCard(cardId, updates) {
  const cardIdx = appState.cards.findIndex(c => c.id === cardId);
  if (cardIdx === -1) return;

  appState.cards[cardIdx] = { ...appState.cards[cardIdx], ...updates };
  saveToLocalStorage();
}

function deleteCard(cardId) {
  if (!confirm('Are you sure you want to delete this card?')) return;

  appState.cards = appState.cards.filter(c => c.id !== cardId);
  appState.relationships = appState.relationships.filter(
    r => r.blocker_id !== cardId && r.blocked_id !== cardId
  );
  saveToLocalStorage();
  closeCardDetailModal();
  renderCurrentBoard();
  showToast('Card deleted successfully');
}

function createNewBoard() {
  const name = document.getElementById('newBoardName').value.trim();
  if (!name) {
    showToast('Please enter a board name', 'warn');
    return;
  }

  const board = {
    id: 'board-' + Date.now(),
    name,
    description: document.getElementById('newBoardDesc').value.trim(),
    position: appState.boards.length,
    columns: [...COLUMNS]
  };

  appState.boards.push(board);
  appState.currentBoardId = board.id;
  saveToLocalStorage();
  closeNewBoardModal();
  renderUI();
  showToast('Board created successfully');
}

// ============================================================================
// Drag and Drop
// ============================================================================

function handleDragOver(e) {
  e.preventDefault();
  e.target.closest('.column-droppable')?.classList.add('column-drag-over');
}

function handleDrop(e, column) {
  e.preventDefault();
  e.target.closest('.column-droppable')?.classList.remove('column-drag-over');

  if (!appState.draggedCardId) return;

  // Update card status to match the column it was dropped into
  const cardIdx = appState.cards.findIndex(c => c.id === appState.draggedCardId);
  if (cardIdx !== -1) {
    appState.cards[cardIdx].status = column;
    saveToLocalStorage();
    showToast(`Card moved to ${column}`);
    renderCurrentBoard();
  }
}

// ============================================================================
// Relationships
// ============================================================================

function addBlockerRelationship(blockerId, blockedId) {
  // Check for circular dependency
  if (hasCircularDependency(blockerId, blockedId)) {
    showToast('Cannot create circular dependency', 'error');
    return;
  }

  const exists = appState.relationships.some(r => r.blocker_id === blockerId && r.blocked_id === blockedId);
  if (exists) {
    showToast('This relationship already exists', 'warn');
    return;
  }

  appState.relationships.push({
    blocker_id: blockerId,
    blocked_id: blockedId,
    created_at: new Date().toISOString()
  });

  saveToLocalStorage();
  showToast('Relationship added');
  renderCurrentBoard();
}

function removeBlockerRelationship(blockerId, blockedId) {
  appState.relationships = appState.relationships.filter(
    r => !(r.blocker_id === blockerId && r.blocked_id === blockedId)
  );
  saveToLocalStorage();
  showToast('Relationship removed');
  renderCurrentBoard();
}

function hasCircularDependency(blockerId, blockedId) {
  const visited = new Set();
  const stack = [blockedId];

  while (stack.length > 0) {
    const current = stack.pop();
    if (visited.has(current)) continue;
    visited.add(current);

    if (current === blockerId) return true;

    const dependencies = appState.relationships
      .filter(r => r.blocker_id === current)
      .map(r => r.blocked_id);
    stack.push(...dependencies);
  }

  return false;
}

// ============================================================================
// Modal Management
// ============================================================================

function openNewCardModal(column) {
  document.getElementById('newCardModal').classList.add('show');
  document.getElementById('newCardTitle').focus();
}

function closeNewCardModal() {
  document.getElementById('newCardModal').classList.remove('show');
  document.getElementById('newCardForm').reset();
}

function openCardDetailModal(cardId) {
  const card = appState.cards.find(c => c.id === cardId);
  if (!card) return;

  appState.selectedCardId = cardId;
  // support multiple assignees
  const assigneeIds = card.assignees || (card.assignee_id ? [card.assignee_id] : []);
  const assignees = assigneeIds.map(id => appState.people.find(p => p.id === id)).filter(Boolean);
  const project = appState.projects.find(p => p.id === card.project_id);
  const blockingRels = appState.relationships.filter(r => r.blocker_id === card.id);
  const blockedByRels = appState.relationships.filter(r => r.blocked_id === card.id);

  document.getElementById('cardDetailTitle').textContent = card.title;
  document.getElementById('cardDetailContent').innerHTML = `
    <div>
      <h4 class="font-semibold text-gray-700">Description</h4>
      <p class="text-gray-600 mt-1">${card.description || 'No description'}</p>
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <h4 class="font-semibold text-gray-700">Priority</h4>
        <p class="text-gray-600 mt-1"><span class="priority-${card.priority} tag">${card.priority}</span></p>
      </div>
      <div>
        <h4 class="font-semibold text-gray-700">Due Date</h4>
        <p class="text-gray-600 mt-1">${card.due_date ? formatDate(card.due_date) : 'No due date'}</p>
      </div>
    </div>
    <div>
      <h4 class="font-semibold text-gray-700">Assignees</h4>
      <p class="text-gray-600 mt-1">${assignees.length > 0 ? assignees.map(a => escapeHtml(a.name)).join(', ') : 'Unassigned'}</p>
    </div>
    <div>
      <h4 class="font-semibold text-gray-700">Project</h4>
      <p class="text-gray-600 mt-1">${project ? project.name : 'None'}</p>
    </div>
    <div>
      <h4 class="font-semibold text-gray-700">Tags</h4>
      <div class="flex flex-wrap gap-2 mt-1">
        ${card.tags.map(tag => `<span class="tag bg-blue-100 text-blue-800">${escapeHtml(tag)}</span>`).join('') || '<p class="text-gray-600">No tags</p>'}
      </div>
    </div>
    <div class="border-t pt-4">
      <h4 class="font-semibold text-gray-700 mb-2">Relationships</h4>
      <div class="text-sm">
        ${blockingRels.length > 0 ? `<p class="text-red-700 mb-1">Blocking: ${blockingRels.map(r => appState.cards.find(c => c.id === r.blocked_id)?.title).join(', ')}</p>` : ''}
        ${blockedByRels.length > 0 ? `<p class="text-red-700">Blocked by: ${blockedByRels.map(r => appState.cards.find(c => c.id === r.blocker_id)?.title).join(', ')}</p>` : ''}
        ${blockingRels.length === 0 && blockedByRels.length === 0 ? '<p class="text-gray-600">No relationships</p>' : ''}
      </div>
      <button id="editRelationshipsBtn" class="mt-3 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition">
        Edit Relationships
      </button>
    </div>
    <div class="border-t pt-4">
      <h4 class="font-semibold text-gray-700 mb-2">Comments (${card.comments.length})</h4>
      <div class="space-y-2 max-h-32 overflow-y-auto" id="cardCommentsList">
        ${card.comments.map(c => `
          <div class="text-sm bg-gray-50 p-2 rounded">
            <p class="font-semibold text-gray-700">${escapeHtml(c.author)}</p>
            <p class="text-gray-600">${escapeHtml(c.text)}</p>
            <p class="text-xs text-gray-500">${new Date(c.timestamp).toLocaleString()}</p>
          </div>
        `).join('') || '<p class="text-gray-600 text-sm">No comments</p>'}
      </div>
      <div class="mt-3 space-y-2">
        <input id="newCommentAuthor" type="text" placeholder="Your name" class="w-full px-3 py-2 border border-gray-300 rounded text-sm">
        <textarea id="newCommentText" placeholder="Add a comment..." class="w-full px-3 py-2 border border-gray-300 rounded text-sm h-20"></textarea>
        <div class="flex justify-end">
          <button id="addCommentBtn" class="px-3 py-2 bg-blue-500 text-white rounded text-sm">Add Comment</button>
        </div>
      </div>
    </div>
    <button id="editCardFromDetailBtn" class="mt-4 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-sm">
      Edit Card
    </button>
  `;

  document.getElementById('editCardFromDetailBtn').addEventListener('click', () => {
    openEditCardModal(cardId);
  });
  document.getElementById('editRelationshipsBtn').addEventListener('click', () => {
    openRelationshipsModal(cardId);
  });

  // Attach add comment handler
  const addBtn = document.getElementById('addCommentBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const authorInput = document.getElementById('newCommentAuthor');
      const textInput = document.getElementById('newCommentText');
      const author = authorInput && authorInput.value.trim() ? authorInput.value.trim() : 'Anonymous';
      const text = textInput && textInput.value.trim();
      if (!text) return alert('Comment text is required');
      addCommentToCard(cardId, author, text);
      if (authorInput) authorInput.value = '';
      if (textInput) textInput.value = '';
    });
  }

  document.getElementById('cardDetailModal').classList.add('show');
}

function closeCardDetailModal() {
  document.getElementById('cardDetailModal').classList.remove('show');
  appState.selectedCardId = null;
}

function openEditCardModal(cardId) {
  const card = appState.cards.find(c => c.id === cardId);
  if (!card) return;

  closeCardDetailModal();

  document.getElementById('editCardId').value = cardId;
  document.getElementById('editCardTitle').value = card.title;
  document.getElementById('editCardDesc').value = card.description;
  document.getElementById('editCardPriority').value = card.priority;
  document.getElementById('editCardDueDate').value = card.due_date || '';
  // set multiple selected assignees
  const editAssigneeSelect = document.getElementById('editCardAssignee');
  const selectedIds = card.assignees || (card.assignee_id ? [card.assignee_id] : []);
  Array.from(editAssigneeSelect.options).forEach(opt => {
    opt.selected = selectedIds.includes(opt.value);
  });
  document.getElementById('editCardProject').value = card.project_id || '';
  document.getElementById('editCardTags').value = card.tags.join(', ');

  document.getElementById('editCardModal').classList.add('show');
}

function closeEditCardModal() {
  document.getElementById('editCardModal').classList.remove('show');
  document.getElementById('editCardForm').reset();
}

function saveEditedCard(e) {
  e.preventDefault();

  const cardId = document.getElementById('editCardId').value;
  const updates = {
    title: document.getElementById('editCardTitle').value.trim(),
    description: document.getElementById('editCardDesc').value.trim(),
    priority: document.getElementById('editCardPriority').value,
    due_date: document.getElementById('editCardDueDate').value || null,
    assignees: Array.from(document.getElementById('editCardAssignee').selectedOptions).map(o => o.value).filter(v => v),
    project_id: document.getElementById('editCardProject').value || null,
    tags: document.getElementById('editCardTags').value.split(',').map(t => t.trim()).filter(t => t)
  };

  updateCard(cardId, updates);
  closeEditCardModal();
  renderCurrentBoard();
  showToast('Card updated successfully');
}

function openNewBoardModal() {
  document.getElementById('newBoardModal').classList.add('show');
  document.getElementById('newBoardName').focus();
}

function closeNewBoardModal() {
  document.getElementById('newBoardModal').classList.remove('show');
  document.getElementById('newBoardForm').reset();
}

function openNewColumnModal() {
  document.getElementById('newColumnModal').classList.add('show');
  document.getElementById('newColumnName').focus();
}

function closeNewColumnModal() {
  document.getElementById('newColumnModal').classList.remove('show');
  document.getElementById('newColumnForm').reset();
}

function openEditBoardModal() {
  const board = appState.boards.find(b => b.id === appState.currentBoardId);
  if (!board) return showToast('No board selected', 'warn');
  document.getElementById('editBoardId').value = board.id;
  document.getElementById('editBoardName').value = board.name;
  document.getElementById('editBoardDesc').value = board.description || '';
  document.getElementById('editBoardModal').classList.add('show');
}

function closeEditBoardModal() {
  document.getElementById('editBoardModal').classList.remove('show');
  document.getElementById('editBoardForm').reset();
}

function saveEditedBoard() {
  const id = document.getElementById('editBoardId').value;
  const name = document.getElementById('editBoardName').value.trim();
  const desc = document.getElementById('editBoardDesc').value.trim();
  if (!name) return showToast('Board name required', 'warn');
  const boardIdx = appState.boards.findIndex(b => b.id === id);
  if (boardIdx === -1) return showToast('Board not found', 'error');
  appState.boards[boardIdx].name = name;
  appState.boards[boardIdx].description = desc;
  saveToLocalStorage();
  closeEditBoardModal();
  renderUI();
  showToast('Board updated');
}

function createNewColumn(e) {
  e.preventDefault();
  const name = document.getElementById('newColumnName').value.trim();
  if (!name) {
    showToast('Please enter a column name', 'warn');
    return;
  }
  const board = appState.boards.find(b => b.id === appState.currentBoardId);
  if (!board) return showToast('No board selected', 'warn');
  board.columns = board.columns || [...COLUMNS];
  // avoid duplicates
  if (board.columns.includes(name)) {
    showToast('Column already exists', 'warn');
    return;
  }
  board.columns.push(name);
  saveToLocalStorage();
  closeNewColumnModal();
  renderCurrentBoard();
  showToast('Column added');
}

function removeColumn(columnName) {
  const board = appState.boards.find(b => b.id === appState.currentBoardId);
  if (!board) return showToast('No board selected', 'warn');
  if (!Array.isArray(board.columns) || board.columns.length <= 1) {
    showToast('Cannot remove the last column', 'warn');
    return;
  }
  // determine target column to move cards into (first column that is not the one being removed)
  const target = board.columns.find(c => c !== columnName) || COLUMNS[0];
  // move cards in the column to the target
  appState.cards.forEach(card => {
    if (card.board_id === board.id && getCardStatus(card) === columnName) {
      card.status = target;
    }
  });
  // remove the column
  board.columns = board.columns.filter(c => c !== columnName);
  saveToLocalStorage();
  renderCurrentBoard();
  showToast('Column removed');
}

function moveColumn(columnName, direction) {
  const board = appState.boards.find(b => b.id === appState.currentBoardId);
  if (!board || !Array.isArray(board.columns)) return showToast('No board selected', 'warn');
  
  const idx = board.columns.indexOf(columnName);
  if (idx === -1) return showToast('Column not found', 'error');
  
  let newIdx;
  if (direction === 'left' && idx > 0) {
    newIdx = idx - 1;
  } else if (direction === 'right' && idx < board.columns.length - 1) {
    newIdx = idx + 1;
  } else {
    return showToast('Cannot move column in that direction', 'warn');
  }
  
  // Swap columns
  [board.columns[idx], board.columns[newIdx]] = [board.columns[newIdx], board.columns[idx]];
  
  saveToLocalStorage();
  renderCurrentBoard();
  showToast('Column moved');
}


function openRelationshipsModal(cardId) {
  const card = appState.cards.find(c => c.id === cardId);
  if (!card) return;

  const blockingRels = appState.relationships.filter(r => r.blocker_id === card.id);
  const blockedByRels = appState.relationships.filter(r => r.blocked_id === card.id);

  document.getElementById('blockingCardsList').innerHTML = blockingRels.length > 0
    ? blockingRels.map((r, idx) => {
        const blockedCard = appState.cards.find(c => c.id === r.blocked_id);
        return `<div class="text-sm bg-blue-50 p-2 rounded flex justify-between items-center mb-1" data-rel-id="blocking-${idx}">
          <span>${escapeHtml(blockedCard.title)}</span>
          <button class="text-red-600 hover:text-red-800 text-xs remove-blocker" data-blocker="${card.id}" data-blocked="${blockedCard.id}">remove</button>
        </div>`;
      }).join('')
    : 'No blocking cards';

  document.getElementById('blockedByCardsList').innerHTML = blockedByRels.length > 0
    ? blockedByRels.map((r, idx) => {
        const blockerCard = appState.cards.find(c => c.id === r.blocker_id);
        return `<div class="text-sm bg-red-50 p-2 rounded flex justify-between items-center mb-1" data-rel-id="blocked-${idx}">
          <span>${escapeHtml(blockerCard.title)}</span>
          <button class="text-red-600 hover:text-red-800 text-xs remove-blocker" data-blocker="${blockerCard.id}" data-blocked="${card.id}">remove</button>
        </div>`;
      }).join('')
    : 'Not blocked by any cards';

  // Populate select dropdowns with other cards
  const otherCards = appState.cards.filter(c => c.id !== card.id && c.board_id === card.board_id);
  document.getElementById('blockingCardsSelect').innerHTML = '<option value="">Select card...</option>' + 
    otherCards.map(c => `<option value="${c.id}">${escapeHtml(c.title)}</option>`).join('');
  document.getElementById('blockedByCardsSelect').innerHTML = '<option value="">Select card...</option>' + 
    otherCards.map(c => `<option value="${c.id}">${escapeHtml(c.title)}</option>`).join('');

  document.getElementById('addBlockerBtn').onclick = () => {
    const selectedId = document.getElementById('blockingCardsSelect').value;
    if (selectedId) {
      addBlockerRelationship(card.id, selectedId);
      openRelationshipsModal(cardId);
    }
  };

  document.getElementById('addBlockedByBtn').onclick = () => {
    const selectedId = document.getElementById('blockedByCardsSelect').value;
    if (selectedId) {
      addBlockerRelationship(selectedId, card.id);
      openRelationshipsModal(cardId);
    }
  };

  // Attach event listeners to remove buttons
  document.querySelectorAll('.remove-blocker').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const blocker = btn.getAttribute('data-blocker');
      const blocked = btn.getAttribute('data-blocked');
      removeBlockerRelationship(blocker, blocked);
      openRelationshipsModal(cardId);
    });
  });

  document.getElementById('relationshipsModal').classList.add('show');
}

function closeRelationshipsModal() {
  document.getElementById('relationshipsModal').classList.remove('show');
}

// ============================================================================
// Filter Controls
// ============================================================================

function populateFilterDropdowns() {
  // Assignees
  const assigneeSelect = document.getElementById('filterAssignee');
  assigneeSelect.innerHTML = '<option value="">All</option>' +
    appState.people.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  assigneeSelect.value = appState.filters.assignee;

  // Projects
  const projectSelect = document.getElementById('filterProject');
  projectSelect.innerHTML = '<option value="">All</option>' +
    appState.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  projectSelect.value = appState.filters.project;

  // Assignees in new/edit modals
  const newAssigneeSelect = document.getElementById('newCardAssignee');
  newAssigneeSelect.innerHTML = appState.people.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

  const editAssigneeSelect = document.getElementById('editCardAssignee');
  editAssigneeSelect.innerHTML = appState.people.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

  // Projects in new/edit modals
  const newProjectSelect = document.getElementById('newCardProject');
  newProjectSelect.innerHTML = '<option value="">None</option>' +
    appState.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

  const editProjectSelect = document.getElementById('editCardProject');
  editProjectSelect.innerHTML = '<option value="">None</option>' +
    appState.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}

// ============================================================================
// Utility Functions
// ============================================================================

function isDueDate(dueDate) {
  if (!dueDate) return { overdue: false, duesSoon: false };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffTime = due - today;
  const diffDays = diffTime / (1000 * 60 * 60 * 24);

  return {
    overdue: diffDays < 0,
    duesSoon: diffDays >= 0 && diffDays <= 3
  };
}

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00Z');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// ============================================================================
// Management: People
// ============================================================================

function openManagePeopleModal() {
  renderPeopleList();
  document.getElementById('managePeopleModal').classList.add('show');
  document.getElementById('newPersonName').focus();
}

function closeManagePeopleModal() {
  document.getElementById('managePeopleModal').classList.remove('show');
  document.getElementById('newPersonForm').reset();
}

function renderPeopleList() {
  const peopleList = document.getElementById('peopleList');
  peopleList.innerHTML = appState.people.map(person => `
    <div class="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
      <div>
        <p class="font-semibold text-gray-900 text-sm">${escapeHtml(person.name)}</p>
        <p class="text-xs text-gray-600">${person.initials}</p>
      </div>
      <button class="text-red-600 hover:text-red-800 text-sm delete-person" data-person-id="${person.id}">Delete</button>
    </div>
  `).join('');

  // Attach delete listeners
  document.querySelectorAll('.delete-person').forEach(btn => {
    btn.addEventListener('click', () => {
      const personId = btn.getAttribute('data-person-id');
      if (confirm('Delete this person? They will be unassigned from all cards.')) {
        deletePerson(personId);
      }
    });
  });
}

function createPerson() {
  const name = document.getElementById('newPersonName').value.trim();
  const initials = document.getElementById('newPersonInitials').value.trim().toUpperCase();

  if (!name || !initials) {
    showToast('Please fill in all fields', 'warn');
    return;
  }

  const person = {
    id: 'p-' + Date.now(),
    name,
    initials
  };

  appState.people.push(person);
  saveToLocalStorage();
  renderPeopleList();
  populateFilterDropdowns();
  document.getElementById('newPersonForm').reset();
  showToast('Person added successfully');
}

function deletePerson(personId) {
  // Remove person from assignments
  appState.cards.forEach(card => {
    // handle single and multiple assignees
    if (card.assignee_id && card.assignee_id === personId) {
      card.assignee_id = null;
    }
    if (Array.isArray(card.assignees)) {
      card.assignees = card.assignees.filter(id => id !== personId);
    }
  });

  // Remove person from list
  appState.people = appState.people.filter(p => p.id !== personId);
  saveToLocalStorage();
  renderPeopleList();
  populateFilterDropdowns();
  renderCurrentBoard();
  showToast('Person deleted');
}

// ============================================================================
// Management: Projects
// ============================================================================

function openManageProjectsModal() {
  renderProjectsList();
  document.getElementById('manageProjectsModal').classList.add('show');
  document.getElementById('newProjectName').focus();
}

function closeManageProjectsModal() {
  document.getElementById('manageProjectsModal').classList.remove('show');
  document.getElementById('newProjectForm').reset();
}

function renderProjectsList() {
  const projectsList = document.getElementById('projectsList');
  projectsList.innerHTML = appState.projects.map(project => `
    <div class="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
      <div>
        <p class="font-semibold text-gray-900 text-sm">${escapeHtml(project.name)}</p>
        <p class="text-xs text-gray-600">${appState.cards.filter(c => c.project_id === project.id).length} cards</p>
      </div>
      <button class="text-red-600 hover:text-red-800 text-sm delete-project" data-project-id="${project.id}">Delete</button>
    </div>
  `).join('');

  // Attach delete listeners
  document.querySelectorAll('.delete-project').forEach(btn => {
    btn.addEventListener('click', () => {
      const projectId = btn.getAttribute('data-project-id');
      if (confirm('Delete this project? Cards will have their project unset.')) {
        deleteProject(projectId);
      }
    });
  });
}

function createProject() {
  const name = document.getElementById('newProjectName').value.trim();

  if (!name) {
    showToast('Please enter a project name', 'warn');
    return;
  }

  const project = {
    id: 'proj-' + Date.now(),
    name
  };

  appState.projects.push(project);
  saveToLocalStorage();
  renderProjectsList();
  populateFilterDropdowns();
  document.getElementById('newProjectForm').reset();
  showToast('Project added successfully');
}

function deleteProject(projectId) {
  // Remove project from assignments
  appState.cards.forEach(card => {
    if (card.project_id === projectId) {
      card.project_id = null;
    }
  });

  // Remove project from list
  appState.projects = appState.projects.filter(p => p.id !== projectId);
  saveToLocalStorage();
  renderProjectsList();
  populateFilterDropdowns();
  renderCurrentBoard();
  showToast('Project deleted');
}

// ============================================================================
// Comments
// ============================================================================

function addCommentToCard(cardId, author, text) {
  const card = appState.cards.find(c => c.id === cardId);
  if (!card) return;
  if (!Array.isArray(card.comments)) card.comments = [];
  const comment = {
    id: 'comm-' + Date.now(),
    author,
    text,
    timestamp: new Date().toISOString()
  };
  card.comments.push(comment);
  saveToLocalStorage();

  // append to comments list if modal is open
  const list = document.getElementById('cardCommentsList');
  if (list) {
    const div = document.createElement('div');
    div.className = 'text-sm bg-gray-50 p-2 rounded';
    div.innerHTML = `<p class="font-semibold text-gray-700">${escapeHtml(comment.author)}</p><p class="text-gray-600">${escapeHtml(comment.text)}</p><p class="text-xs text-gray-500">${new Date(comment.timestamp).toLocaleString()}</p>`;
    // if 'No comments' placeholder exists, remove it
    if (list.querySelector('p.text-gray-600.text-sm')) list.innerHTML = '';
    list.appendChild(div);
  }
  // update relationships/modal counters if needed by re-opening or updating header
  const header = document.querySelector('#cardDetailContent h4.font-semibold');
  // Optionally refresh modal count by re-rendering the modal
}

// ============================================================================
// Event Listeners
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Modal triggers
  document.getElementById('newBoardBtn').addEventListener('click', openNewBoardModal);
  document.getElementById('cancelNewBoardBtn').addEventListener('click', closeNewBoardModal);
  document.getElementById('newBoardForm').addEventListener('submit', (e) => {
    e.preventDefault();
    createNewBoard();
  });

  document.getElementById('cancelNewCardBtn').addEventListener('click', closeNewCardModal);
  document.getElementById('newCardForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const column = document.querySelector('.column-droppable')?.dataset?.column || 'TODO';
    createNewCard(column);
  });

  document.getElementById('closeCardDetailBtn').addEventListener('click', closeCardDetailModal);
  document.getElementById('cancelEditCardBtn').addEventListener('click', closeEditCardModal);
  document.getElementById('editCardForm').addEventListener('submit', saveEditedCard);
  document.getElementById('deleteCardBtn').addEventListener('click', () => {
    // Prefer explicit id from edit form (works when opened directly), fallback to selectedCardId
    const editIdInput = document.getElementById('editCardId');
    const idToDelete = (editIdInput && editIdInput.value) ? editIdInput.value : appState.selectedCardId;
    if (!idToDelete) return showToast('No card selected to delete', 'warn');
    deleteCard(idToDelete);
  });

  document.getElementById('closeRelationshipsBtn').addEventListener('click', closeRelationshipsModal);

  // Data management
  document.getElementById('exportJsonBtn').addEventListener('click', exportJSON);
  document.getElementById('importJsonBtn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', importJSON);
    input.click();
  });

  // Filters
  document.getElementById('filterToggleBtn').addEventListener('click', () => {
    document.getElementById('filterPanel').classList.toggle('hidden');
  });

  document.getElementById('resetFiltersBtn').addEventListener('click', () => {
    appState.filters = { search: '', assignee: '', priority: '', project: '', status: '', tags: [] };
    document.getElementById('searchInput').value = '';
    document.getElementById('filterAssignee').value = '';
    document.getElementById('filterPriority').value = '';
    document.getElementById('filterProject').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterTags').value = '';
    renderCurrentBoard();
  });

  document.getElementById('searchInput').addEventListener('input', (e) => {
    appState.filters.search = e.target.value;
    renderCurrentBoard();
  });

  document.getElementById('filterAssignee').addEventListener('change', (e) => {
    appState.filters.assignee = e.target.value;
    renderCurrentBoard();
  });

  document.getElementById('filterPriority').addEventListener('change', (e) => {
    appState.filters.priority = e.target.value;
    renderCurrentBoard();
  });

  document.getElementById('filterProject').addEventListener('change', (e) => {
    appState.filters.project = e.target.value;
    renderCurrentBoard();
  });

  document.getElementById('filterStatus').addEventListener('change', (e) => {
    appState.filters.status = e.target.value;
    renderCurrentBoard();
  });

  document.getElementById('filterTags').addEventListener('change', (e) => {
    appState.filters.tags = e.target.value.split(',').map(t => t.trim()).filter(t => t);
    renderCurrentBoard();
  });

  // Management
  document.getElementById('managePeopleBtn').addEventListener('click', openManagePeopleModal);
  document.getElementById('closePeopleModalBtn').addEventListener('click', closeManagePeopleModal);
  document.getElementById('newPersonForm').addEventListener('submit', (e) => {
    e.preventDefault();
    createPerson();
    openManagePeopleModal();
  });

  document.getElementById('manageProjectsBtn').addEventListener('click', openManageProjectsModal);
  document.getElementById('closeProjectsModalBtn').addEventListener('click', closeManageProjectsModal);
  document.getElementById('newProjectForm').addEventListener('submit', (e) => {
    e.preventDefault();
    createProject();
    openManageProjectsModal();
  });

  // New column modal handlers
  const addColumnBtn = document.getElementById('addColumnBtn');
  if (addColumnBtn) addColumnBtn.addEventListener('click', openNewColumnModal);
  const cancelNewColumnBtn = document.getElementById('cancelNewColumnBtn');
  if (cancelNewColumnBtn) cancelNewColumnBtn.addEventListener('click', closeNewColumnModal);
  const newColumnForm = document.getElementById('newColumnForm');
  if (newColumnForm) newColumnForm.addEventListener('submit', createNewColumn);

  // Edit board modal handlers
  const editBoardBtn = document.getElementById('editBoardBtn');
  if (editBoardBtn) editBoardBtn.addEventListener('click', openEditBoardModal);
  const cancelEditBoardBtn = document.getElementById('cancelEditBoardBtn');
  if (cancelEditBoardBtn) cancelEditBoardBtn.addEventListener('click', closeEditBoardModal);
  const editBoardForm = document.getElementById('editBoardForm');
  if (editBoardForm) editBoardForm.addEventListener('submit', (e) => { e.preventDefault(); saveEditedBoard(); });

  // Modal backdrop clicks
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove('show');
      }
    });
  });

  // Load data
  loadData();
});

