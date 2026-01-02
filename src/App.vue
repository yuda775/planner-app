<template>
  <div class="app-container">
    <!-- Header -->
    <header class="header">
      <div class="header-content">
        <h1>My Tasks</h1>
        <p class="date">{{ currentDate }}</p>
      </div>
      <div class="stats">
        <span>{{todos.filter(t => !t.done).length}} left</span>
      </div>
    </header>

    <!-- Todo List -->
    <main class="todo-list" ref="listContainer">
      <div v-if="loading" class="loading">Loading...</div>

      <div v-else-if="todos.length === 0" class="empty-state">
        <div class="empty-icon">📝</div>
        <p>No tasks yet. Add one!</p>
      </div>

      <TransitionGroup name="list" tag="ul" class="list-group">
        <li v-for="todo in sortedTodos" :key="todo.id" class="todo-item" :class="{ 'is-done': todo.done }">
          <label class="custom-checkbox">
            <input type="checkbox" :checked="todo.done" @change="toggleTodo(todo)" />
            <span class="checkmark"></span>
          </label>

          <div class="text-content">
            <span class="todo-text">{{ todo.text }}</span>
            <span v-if="todo.reminderTime" class="reminder-badge">
              ⏰ {{ formatTime(todo.reminderTime) }}
            </span>
          </div>

          <div class="actions">
            <button class="icon-btn reminder-btn" @click="openReminderModal(todo)"
              :class="{ 'has-reminder': todo.reminderTime }">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
            </button>
            <button class="icon-btn delete-btn" @click="deleteTodo(todo)">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </li>
      </TransitionGroup>
    </main>

    <!-- Bottom Input Area -->
    <footer class="footer">
      <div class="input-wrapper">
        <input v-model="newItem" @keyup.enter="addTodo" placeholder="New task..." class="todo-input" />
        <button @click="addTodo" class="add-btn" :disabled="!newItem.trim()">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>
    </footer>

    <!-- Reminder Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <h3>Set Reminder</h3>
        <p>For: {{ selectedTodo?.text }}</p>

        <input type="datetime-local" v-model="reminderDate" class="date-input" />

        <div class="modal-actions">
          <button v-if="selectedTodo?.reminderTime" class="btn-danger" @click="cancelReminder">Remove Reminder</button>
          <div class="spacer"></div>
          <button class="btn-secondary" @click="closeModal">Cancel</button>
          <button class="btn-primary" @click="saveReminder">Save</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup vapor>
import { ref, computed, onMounted, toRaw } from 'vue';
import { initDB } from './db';
import { LocalNotifications } from '@capacitor/local-notifications';

const todos = ref([]);
const newItem = ref('');
const loading = ref(true);
let db;

// Modal State
const showModal = ref(false);
const selectedTodo = ref(null);
const reminderDate = ref('');

// Helper for date display
const currentDate = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric'
});

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Computed: Sort todos
const sortedTodos = computed(() => {
  return [...todos.value].sort((a, b) => {
    if (a.done === b.done) {
      return b.createdAt - a.createdAt;
    }
    return a.done ? 1 : -1;
  });
});

onMounted(async () => {
  try {

    db = await initDB();

    // Subscribe to query
    db.todos.find().$.subscribe(docs => {
      todos.value = docs;
      loading.value = false;
    });

    // Request Notification Permissions
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') {
      console.warn("Notifications not granted");
    }

  } catch (e) {
    console.error("DB Error:", e);
    loading.value = false;
  }
});

const addTodo = async () => {
  const text = newItem.value.trim();
  if (!text) return;

  try {
    await db.todos.insert({
      id: crypto.randomUUID(),
      text: text,
      done: false,
      createdAt: Date.now(),
      notificationId: null,
      reminderTime: null
    });
    newItem.value = '';
  } catch (err) {
    console.error("Add failed:", err);
  }
};

const toggleTodo = async (todo) => {
  try {
    const rawTodo = toRaw(todo);
    await rawTodo.incrementalPatch({ done: !rawTodo.done });
  } catch (err) {
    console.error("Toggle failed", err);
  }
};

const deleteTodo = async (todo) => {
  try {
    const rawTodo = toRaw(todo);

    // Cancel notification if exists
    if (rawTodo.notificationId) {
      await LocalNotifications.cancel({ notifications: [{ id: rawTodo.notificationId }] });
    }

    await rawTodo.remove();
  } catch (err) {
    console.error("Delete failed", err);
  }
};

// Reminder Logic
const openReminderModal = (todo) => {
  selectedTodo.value = todo;
  // Pre-fill date if exists
  if (todo.reminderTime) {
    const date = new Date(todo.reminderTime);
    // Format for datetime-local: YYYY-MM-DDThh:mm
    const offset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date - offset)).toISOString().slice(0, 16);
    reminderDate.value = localISOTime;
  } else {
    reminderDate.value = '';
  }
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  selectedTodo.value = null;
  reminderDate.value = '';
};

const saveReminder = async () => {
  if (!selectedTodo.value || !reminderDate.value) return;

  const rawTodo = toRaw(selectedTodo.value);
  const triggerTime = new Date(reminderDate.value).getTime();
  const now = Date.now();

  if (triggerTime <= now) {
    alert("Please select a future time");
    return;
  }

  try {
    // 1. Cancel existing if any
    if (rawTodo.notificationId) {
      await LocalNotifications.cancel({ notifications: [{ id: rawTodo.notificationId }] });
    }

    // 3. Schedule new
    // Generate a numeric ID for the notification
    const newNotifId = Math.floor(Math.random() * 100000000);

    const notificationPayload = {
      title: "Todo Reminder",
      body: rawTodo.text,
      id: newNotifId,
      schedule: { at: new Date(triggerTime) }
    };

    // Only add extra fields if they exist to avoid validation errors on some platforms
    if (rawTodo.sound) notificationPayload.sound = rawTodo.sound;

    await LocalNotifications.schedule({
      notifications: [notificationPayload]
    });

    // 4. Update DB
    await rawTodo.incrementalPatch({
      notificationId: newNotifId,
      reminderTime: triggerTime
    });

    closeModal();
  } catch (err) {
    console.error("Scheduling failed details:", err);
    // Specific check for Web Permission issues
    if (Notification.permission !== 'granted') {
      alert("Permission not granted. Please enable notifications in your browser settings.");
    } else {
      alert("Failed to schedule: " + (err.message || err));
    }
  }
};

const cancelReminder = async () => {
  if (!selectedTodo.value) return;
  const rawTodo = toRaw(selectedTodo.value);

  try {
    if (rawTodo.notificationId) {
      await LocalNotifications.cancel({ notifications: [{ id: rawTodo.notificationId }] });
    }
    await rawTodo.incrementalPatch({
      notificationId: null,
      reminderTime: null
    });
    closeModal();
  } catch (err) {
    console.error("Cancel failed", err);
  }
};

</script>

<style>
/* CSS Reset & Variables */
:root {
  --primary: #6366f1;
  --bg-color: #f8fafc;
  --text-main: #1e293b;
  --text-muted: #64748b;
  --card-bg: #ffffff;
  --danger: #ef4444;
  --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background-color: var(--bg-color);
  color: var(--text-main);
  -webkit-tap-highlight-color: transparent;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 600px;
  margin: 0 auto;
  background-color: var(--bg-color);
  position: relative;
}

/* Header */
.header {
  padding: 2rem 1.5rem 1rem;
  background: var(--bg-color);
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  z-index: 10;
}

.header h1 {
  margin: 0;
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  background: linear-gradient(135deg, var(--primary), #8b5cf6);
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.date {
  margin: 0.25rem 0 0;
  color: var(--text-muted);
  font-size: 0.875rem;
  font-weight: 500;
}

.stats {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--primary);
  background: #e0e7ff;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
}

/* List Area */
.todo-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.5rem 6rem;
  /* Bottom padding for fixed footer */
}

.list-group {
  list-style: none;
  padding: 0;
  margin: 0;
}

.todo-item {
  background: var(--card-bg);
  padding: 1rem;
  margin-bottom: 0.75rem;
  border-radius: 16px;
  box-shadow: var(--shadow);
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: transform 0.2s, box-shadow 0.2s;
}

.todo-item:active {
  transform: scale(0.98);
}

.todo-item.is-done {
  opacity: 0.6;
  background: #f1f5f9;
  box-shadow: none;
}

.todo-item.is-done .todo-text {
  text-decoration: line-through;
  color: var(--text-muted);
}

.text-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.todo-text {
  font-size: 1rem;
  font-weight: 500;
  word-break: break-word;
}

.reminder-badge {
  font-size: 0.75rem;
  color: var(--primary);
  background: #e0e7ff;
  padding: 2px 6px;
  border-radius: 4px;
  align-self: flex-start;
  font-weight: 600;
}

/* Custom Checkbox */
.custom-checkbox {
  position: relative;
  width: 24px;
  height: 24px;
  cursor: pointer;
  flex-shrink: 0;
}

.custom-checkbox input {
  opacity: 0;
  width: 0;
  height: 0;
}

.checkmark {
  position: absolute;
  top: 0;
  left: 0;
  height: 24px;
  width: 24px;
  background-color: #eee;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.custom-checkbox:hover input~.checkmark {
  background-color: #ccc;
}

.custom-checkbox input:checked~.checkmark {
  background-color: var(--primary);
}

.checkmark:after {
  content: "";
  position: absolute;
  display: none;
}

.custom-checkbox input:checked~.checkmark:after {
  display: block;
}

.custom-checkbox .checkmark:after {
  left: 9px;
  top: 5px;
  width: 6px;
  height: 12px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

/* Buttons */
.actions {
  display: flex;
  gap: 0.5rem;
}

.icon-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  transition: color 0.2s, background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-btn:hover {
  color: var(--danger);
  background: #fee2e2;
}

.reminder-btn:hover {
  color: var(--primary);
  background: #e0e7ff;
}

.reminder-btn.has-reminder {
  color: var(--primary);
}

/* Footer / Input */
.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  padding: 1rem 1.5rem 1.5rem;
  background: linear-gradient(to top, var(--bg-color) 80%, transparent);
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.input-wrapper {
  pointer-events: auto;
  width: 100%;
  max-width: 600px;
  display: flex;
  gap: 0.5rem;
  background: var(--card-bg);
  padding: 0.5rem;
  border-radius: 999px;
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  border: 1px solid #e2e8f0;
}

.todo-input {
  flex: 1;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 999px;
  font-size: 1rem;
  outline: none;
  background: transparent;
}

.add-btn {
  background: var(--primary);
  color: white;
  border: none;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s, background 0.2s;
  flex-shrink: 0;
}

.add-btn:hover {
  background: #4f46e5;
  transform: scale(1.05);
}

.add-btn:active {
  transform: scale(0.95);
}

.add-btn:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-top: 4rem;
  color: var(--text-muted);
  text-align: center;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(2px);
  padding: 1rem;
}

.modal-content {
  background: white;
  padding: 1.5rem;
  border-radius: 16px;
  width: 100%;
  max-width: 320px;
  box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1);
}

.modal-content h3 {
  margin-top: 0;
  margin-bottom: 0.5rem;
}

.modal-content p {
  color: var(--text-muted);
  margin-bottom: 1.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.date-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
  margin-bottom: 1.5rem;
}

.modal-actions {
  display: flex;
  gap: 0.5rem;
}

.modal-actions .spacer {
  flex: 1;
}

.btn-primary,
.btn-secondary,
.btn-danger {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: none;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-secondary {
  background: #f1f5f9;
  color: var(--text-main);
}

.btn-danger {
  background: #fee2e2;
  color: var(--danger);
  font-size: 0.875rem;
}

/* Animations */
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.4s ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateY(30px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.list-leave-active {
  position: absolute;
  width: 100%;
}
</style>