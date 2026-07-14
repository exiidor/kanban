# Kanban Board Application

A fully-featured, single-page kanban board application built with vanilla JavaScript, HTML, and Tailwind CSS. All data is managed in a single JSON file that syncs with browser localStorage.

<img width="1920" height="1015" alt="image" src="https://github.com/user-attachments/assets/4b7d2416-8912-4d0f-88c0-87e852c5e3a1" />

## Features

### Board Management
- **Multiple Boards**: Create and switch between unlimited boards
- **Board Workflow**: Each board has TODO, In Progress, and Done columns
- **Board Descriptions**: Add context to each board
- **Custom Columns**: Future enhancement for user-defined columns

### Card Management
- **Complete Card Details**:
  - Title & description
  - Priority (high/medium/low) with color coding
  - Due dates with visual indicators (overdue in red, due soon in orange)
  - Multiple tags per card
  - Assignee (team member)
  - Project association
  - Comments section

- **Card Operations**:
  - Create new cards with full details
  - Edit any field inline
  - Delete cards
  - Drag-to-reorder between columns

### Relationships
- **Blocking References**: Card A blocks Card B (e.g., waiting for another task)
- **Circular Dependency Prevention**: System prevents creating circular blocks
- **Visual Indicators**: Cards show how many relationships they have
- **Relationship Management Modal**: Easy add/remove blocking links

### Filtering & Search
- **Real-time Search**: Filter cards by title or description
- **Multi-field Filters**:
  - By assignee
  - By priority level
  - By project
  - By due date status (overdue, due soon, no due date)
  - By tags (comma-separated)
- **Reset Filters**: One-click reset to clear all filters

### Data Management
- **JSON Data File** (`data.json`):
  - Single source of truth
  - Human-readable and editable
  - Contains boards, cards, projects, team members, and relationships
  
- **localStorage Sync**:
  - All changes auto-save to browser localStorage
  - Fast reopening on same device
  - Data persists across browser restarts (until cleared)

- **Import/Export**:
  - Export current state as JSON file (with date stamp)
  - Import JSON to replace all data
  - Enables backup and version control

## File Structure

```
kanban/
├── index.html       # UI structure and styling (Tailwind CSS)
├── script.js        # All JavaScript logic (550+ lines)
└── data.json        # Board, card, project, and team data
```

## How to Use

### 1. Open the Application
```bash
# Open index.html in any modern web browser
# File menu → Open or drag/drop index.html into browser
```

### 2. Create a Board
1. Click "+ New Board" in the sidebar
2. Enter board name and optional description
3. Click "Create"

### 3. Add Cards
1. Click "+ Add Card" in any column (TODO, In Progress, Done)
2. Fill in:
   - **Title** (required)
   - **Description** (optional)
   - **Priority** (defaults to Medium)
   - **Due Date** (optional)
   - **Assignee** (optional, assign to team member)
   - **Project** (optional, tag with internal project)
   - **Tags** (optional, comma-separated)
3. Click "Create"

### 4. Edit a Card
1. Click on any card to open detail view
2. Click "Edit Card" button
3. Modify any field
4. Click "Save"

### 5. Manage Relationships
1. Open card detail view
2. Click "Edit Relationships"
3. Add blockers (this card is blocked by...) or blocked cards (this card blocks...)
4. Select from dropdown and click "Add"
5. Remove relationships with "remove" button

### 6. Filter Cards
1. Click "Filter" button in top bar
2. Set any filters:
   - **Assignee**: Show only cards assigned to person
   - **Priority**: Show only high/medium/low
   - **Project**: Show only cards in specific project
   - **Status**: Show overdue, due soon, or no due date
   - **Tags**: Filter by comma-separated tags
3. Results update in real-time
4. Click "Reset" to clear all filters

### 7. Search
1. Type in "Search cards..." box in top bar
2. Cards with matching title or description appear
3. Combine with filters for powerful queries

### 8. Export Data
1. Click "Export JSON" button in sidebar
2. Browser downloads `kanban-export-YYYY-MM-DD.json`
3. Use as backup or version control

### 9. Import Data
1. Click "Import JSON" button in sidebar
2. Select a previously exported JSON file
3. All boards, cards, and relationships are replaced with imported data

## Data Schema

### data.json Structure

```json
{
  "boards": [
    {
      "id": "board-1",
      "name": "Product Development",
      "description": "Main workflow",
      "position": 0
    }
  ],
  "projects": [
    {
      "id": "proj-1",
      "name": "Frontend Redesign"
    }
  ],
  "people": [
    {
      "id": "p-1",
      "name": "Alice Johnson",
      "initials": "AJ"
    }
  ],
  "cards": [
    {
      "id": "card-1",
      "title": "Design new landing page",
      "description": "Create mockups...",
      "board_id": "board-1",
      "assignee_id": "p-1",
      "tags": ["design", "frontend"],
      "priority": "high",
      "due_date": "2026-07-15",
      "project_id": "proj-1",
      "position": 0,
      "comments": [
        {
          "author": "Alice Johnson",
          "text": "Started on wireframes",
          "timestamp": "2026-07-10T10:30:00Z"
        }
      ]
    }
  ],
  "relationships": [
    {
      "blocker_id": "card-3",
      "blocked_id": "card-2",
      "created_at": "2026-07-10T10:00:00Z"
    }
  ]
}
```

## Technical Stack

- **HTML5**: Semantic markup, forms
- **CSS3**: Tailwind CSS (CDN), custom animations, responsive design
- **JavaScript (Vanilla)**: No frameworks or build tools
  - DOM manipulation
  - Event handling
  - localStorage API
  - File I/O (import/export)
- **Browser APIs**: LocalStorage, Fetch, FileReader, Blob

## Browser Compatibility

Works in all modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

Requires JavaScript enabled. No server or build tools needed.

## Storage Location

- **LocalStorage**: Browser stores data from localStorage automatically (accessible via DevTools → Application → LocalStorage)
- **JSON File**: data.json in same directory as index.html

## Limitations & Future Enhancements

### Current Limitations
- No timestamps on card updates (only on comments)
- No undo/redo history

### Possible Future Features
- Card templates for bulk creation
- Recurring tasks
- Time tracking
- Dark mode toggle
- Card color labels
- Subtasks
- Card attachments
