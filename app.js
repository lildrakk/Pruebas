const BACKEND = "http://nc.lynxnodes.es:25677/generate";

// Estado simple en memoria
let chats = [];
let currentChatId = null;
let currentMode = "chat";
let attachedFiles = [];
let attachedImages = [];

// Utilidades
function createId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getCurrentChat() {
  return chats.find((c) => c.id === currentChatId) || null;
}

function ensureChat() {
  if (!currentChatId) {
    const id = createId();
    const chat = {
      id,
      title: "Nuevo chat",
      messages: [],
      createdAt: new Date().toISOString(),
    };
    chats.unshift(chat);
    currentChatId = id;
    renderChatList();
  }
}

// Render de lista de chats
function renderChatList() {
  const list = document.getElementById("chat-list");
  list.innerHTML = "";

  if (chats.length === 0) {
    const empty = document.createElement("div");
    empty.className = "panel-item";
    empty.textContent = "No hay chats todavía.";
    list.appendChild(empty);
    return;
  }

  chats.forEach((chat) => {
    const item = document.createElement("div");
    item.className = "chat-list-item" + (chat.id === currentChatId ? " active" : "");
    item.textContent = chat.title || "Chat sin título";
    item.onclick = () => {
      currentChatId = chat.id;
      renderChatList();
      renderMessages();
    };
    list.appendChild(item);
  });
}

// Render de mensajes
function renderMessages() {
  const chat = getCurrentChat();
  const cont = document.getElementById("messages");
  const welcome = document.getElementById("welcome");

  cont.innerHTML = "";

  if (!chat || chat.messages.length === 0) {
    welcome.style.display = "block";
    return;
  }

  welcome.style.display = "none";

  chat.messages.forEach((msg) => {
    const row = document.createElement("div");
    row.className = "message-row " + (msg.role === "user" ? "user" : "ai");

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = msg.role === "user" ? "Tú" : "XA";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    // 🔥 Detectar si el mensaje es un archivo
    if (msg.type === "file") {
      bubble.innerHTML = `
        <div class="file-box">
          <div class="file-icon">📦</div>
          <div class="file-info">
            <strong>${msg.name}</strong>
            <a href="${msg.url}" download class="download-btn">
              Descargar archivo
            </a>
          </div>
        </div>
      `;
    } else {
      bubble.textContent = msg.content;
    }

    row.appendChild(avatar);
    row.appendChild(bubble);
    cont.appendChild(row);
  });

  cont.scrollTop = cont.scrollHeight;
}

// Añadir mensaje al chat actual
function addMessage(role, content) {
  ensureChat();
  const chat = getCurrentChat();
  chat.messages.push({ role, content, id: createId(), createdAt: new Date().toISOString() });

  if (role === "user" && chat.messages.length === 1) {
    chat.title = content.slice(0, 40) + (content.length > 40 ? "..." : "");
  }

  renderChatList();
  renderMessages();
}

// Modo (chat / file)
function setMode(mode) {
  currentMode = mode;
  document.getElementById("mode-chat").classList.toggle("active", mode === "chat");
  document.getElementById("mode-file").classList.toggle("active", mode === "file");
}

// Adjuntos
function renderAttached() {
  const cont = document.getElementById("attached-files");
  cont.innerHTML = "";

  const all = [
    ...attachedFiles.map((f) => ({ type: "file", name: f.name })),
    ...attachedImages.map((f) => ({ type: "img", name: f.name })),
  ];

  all.forEach((item) => {
    const pill = document.createElement("div");
    pill.className = "file-pill";
    pill.textContent = (item.type === "img" ? "🖼️ " : "📄 ") + item.name;
    cont.appendChild(pill);
  });
}

// Enviar mensaje
async function sendMessage() {
  const promptEl = document.getElementById("prompt");
  const langEl = document.getElementById("language");
  const prompt = promptEl.value.trim();
  const language = langEl.value.trim();

  if (!prompt) return;

  addMessage("user", prompt);
  promptEl.value = "";
  autoResizeTextarea();

  try {
    const res = await fetch(BACKEND, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        mode: currentMode,
        language: language || null,
      }),
    });

    const data = await res.json();

    // 🔥 Si es archivo, guardarlo como mensaje especial
    if (data.type === "file") {
      const chat = getCurrentChat();
      chat.messages.push({
        role: "ai",
        type: "file",
        name: data.name || data.filename,
        url: data.url || data.file_url,
        id: createId(),
        createdAt: new Date().toISOString(),
      });

      renderMessages();
      return;
    }

    // Mensaje normal
    const content = data.content || "Sin respuesta de Xtreme AI.";
    addMessage("ai", content);

  } catch (err) {
    addMessage("ai", "Error al conectar con Xtreme AI.");
  }
}

// Auto-resize textarea
function autoResizeTextarea() {
  const ta = document.getElementById("prompt");
  ta.style.height = "auto";
  ta.style.height = ta.scrollHeight + "px";
}

// Nuevo chat
function newChat() {
  const id = createId();
  const chat = {
    id,
    title: "Nuevo chat",
    messages: [],
    createdAt: new Date().toISOString(),
  };
  chats.unshift(chat);
  currentChatId = id;
  renderChatList();
  renderMessages();
}

// Sidebar / menú
function openSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  sidebar.classList.add("open");
  overlay.classList.add("visible");
}

function closeSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  sidebar.classList.remove("open");
  overlay.classList.remove("visible");
}

// Sidepanel
function openSidepanel(title, contentHtml) {
  const panel = document.getElementById("sidepanel");
  document.getElementById("sidepanel-title").textContent = title;
  document.getElementById("sidepanel-content").innerHTML = contentHtml;
  panel.classList.add("open");
}

function closeSidepanel() {
  const panel = document.getElementById("sidepanel");
  panel.classList.remove("open");
}

// Paneles
function showProfilePanel() {
  openSidepanel(
    "Perfil",
    `
    <div class="panel-section">
      <div class="panel-section-title">Usuario</div>
      <div class="panel-item">Nombre: Invitado</div>
      <div class="panel-item">Rol: Desarrollador</div>
    </div>
  `
  );
}

function showSettingsPanel() {
  openSidepanel(
    "Ajustes",
    `
    <div class="panel-section">
      <div class="panel-section-title">Preferencias</div>
      <div class="panel-item">Tema: Oscuro</div>
      <div class="panel-item">Idioma: Español</div>
    </div>
  `
  );
}

function showAboutPanel() {
  openSidepanel(
    "Acerca de Xtreme AI",
    `
    <div class="panel-section">
      <div class="panel-section-title">Descripción</div>
      <div class="panel-item">
        Xtreme AI es un asistente especializado en código, integrado con XtremeCloud.
      </div>
    </div>
  `
  );
}

// Adjuntar archivos
function handleAttachFile() {
  document.getElementById("file-input").click();
}

function handleAttachImage() {
  document.getElementById("image-input").click();
}

function onFilesSelected(e, type) {
  const files = Array.from(e.target.files || []);
  if (type === "file") {
    attachedFiles = attachedFiles.concat(files);
  } else {
    attachedImages = attachedImages.concat(files);
  }
  renderAttached();
}

// Tema
function toggleTheme() {
  console.log("Tema alternado (placeholder).");
}

// Inicialización
function init() {
  document.getElementById("mode-chat").addEventListener("click", () => setMode("chat"));
  document.getElementById("mode-file").addEventListener("click", () => setMode("file"));

  document.getElementById("send-button").addEventListener("click", sendMessage);

  const ta = document.getElementById("prompt");
  ta.addEventListener("input", autoResizeTextarea);
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  document.getElementById("new-chat-btn").addEventListener("click", () => {
    newChat();
    closeSidebar();
  });

  document.getElementById("menu-toggle").addEventListener("click", openSidebar);
  document.getElementById("sidebar-close").addEventListener("click", closeSidebar);
  document.getElementById("overlay").addEventListener("click", closeSidebar);

  document.getElementById("avatar-button").addEventListener("click", showProfilePanel);
  document.getElementById("profile-btn").addEventListener("click", () => {
    showProfilePanel();
    closeSidebar();
  });
  document.getElementById("settings-btn").addEventListener("click", () => {
    showSettingsPanel();
    closeSidebar();
  });
  document.getElementById("about-btn").addEventListener("click", () => {
    showAboutPanel();
    closeSidebar();
  });
  document.getElementById("sidepanel-close").addEventListener("click", closeSidepanel);

  document.getElementById("attach-file-btn").addEventListener("click", handleAttachFile);
  document.getElementById("attach-image-btn").addEventListener("click", handleAttachImage);
  document.getElementById("file-input").addEventListener("change", (e) =>
    onFilesSelected(e, "file")
  );
  document.getElementById("image-input").addEventListener("change", (e) =>
    onFilesSelected(e, "img")
  );

  document.getElementById("theme-toggle").addEventListener("click", toggleTheme);

  setMode("chat");
  renderChatList();
  renderMessages();
}

document.addEventListener("DOMContentLoaded", init);
