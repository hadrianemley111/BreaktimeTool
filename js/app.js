const STORAGE_KEYS = {
  data: "breakTrackerData",
  settings: "breakTrackerSettings",
  accessAcknowledged: "breakTrackerAccessAcknowledged"
};

const DEFAULT_SETTINGS = {
  breakMinutes: 30,
  lateGrace: 5
};

const PERMISSIONS_TEAM_URL =
  "https://permissions.amazon.com/a/team/Break%20Time%20KCVG";

let breakData = readJson(STORAGE_KEYS.data, []);
let settings = readJson(STORAGE_KEYS.settings, DEFAULT_SETTINGS);

const elements = {
  accessScreen: document.getElementById("accessScreen"),
  app: document.getElementById("app"),
  continueButton: document.getElementById("continueButton"),

  currentDate: document.getElementById("currentDate"),
  currentTime: document.getElementById("currentTime"),

  badgeInput: document.getElementById("badgeInput"),
  nameInput: document.getElementById("nameInput"),
  lastScan: document.getElementById("lastScan"),

  onBreakCount: document.getElementById("onBreakCount"),
  lateCount: document.getElementById("lateCount"),
  returnedCount: document.getElementById("returnedCount"),
  totalCount: document.getElementById("totalCount"),
  breakTableBody: document.getElementById("breakTableBody"),

  settingsButton: document.getElementById("settingsButton"),
  settingsModal: document.getElementById("settingsModal"),
  closeSettingsButton: document.getElementById("closeSettingsButton"),
  cancelSettingsButton: document.getElementById("cancelSettingsButton"),
  saveSettingsButton: document.getElementById("saveSettingsButton"),
  breakMinutes: document.getElementById("breakMinutes"),
  lateGrace: document.getElementById("lateGrace"),
  summaryBreak: document.getElementById("summaryBreak"),
  summaryGrace: document.getElementById("summaryGrace"),

  downloadButton: document.getElementById("downloadButton"),
  uploadButton: document.getElementById("uploadButton"),
  uploadFile: document.getElementById("uploadFile"),
  clearButton: document.getElementById("clearButton")
};

function readJson(key, fallbackValue) {
  try {
    const rawValue = localStorage.getItem(key);

    if (!rawValue) {
      return fallbackValue;
    }

    return JSON.parse(rawValue);
  } catch {
    return fallbackValue;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function saveData() {
  writeJson(STORAGE_KEYS.data, breakData);
}

function saveSettings() {
  settings.breakMinutes = Number(elements.breakMinutes.value);
  settings.lateGrace = Number(elements.lateGrace.value);

  writeJson(STORAGE_KEYS.settings, settings);
  loadSettingsIntoPage();
  closeSettings();
}

function loadSettingsIntoPage() {
  elements.breakMinutes.value = String(settings.breakMinutes);
  elements.lateGrace.value = String(settings.lateGrace);
  elements.summaryBreak.textContent = settings.breakMinutes;
  elements.summaryGrace.textContent = settings.lateGrace;
}

function continueToApp() {
  localStorage.setItem(STORAGE_KEYS.accessAcknowledged, "true");
  showApp();
}

function showApp() {
  elements.accessScreen.style.display = "none";
  elements.app.style.display = "block";

  setTimeout(() => elements.badgeInput.focus(), 100);
}

function checkAccessGate() {
  const acknowledged =
    localStorage.getItem(STORAGE_KEYS.accessAcknowledged) === "true";

  if (acknowledged) {
    showApp();
  }
}

function updateHeaderClock() {
  const now = new Date();

  elements.currentDate.textContent = now.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  elements.currentTime.textContent = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function scanBadge() {
  const badge = elements.badgeInput.value.trim();
  const name = elements.nameInput.value.trim();

  if (!badge) {
    elements.badgeInput.focus();
    return;
  }

  const activeBreak = breakData.find(
    item => item.badge === badge && item.status !== "Returned"
  );

  if (activeBreak) {
    activeBreak.returnTime = new Date().toISOString();
    activeBreak.status = "Returned";

    elements.lastScan.innerHTML =
      `<strong>Last Scan:</strong> ${escapeHtml(badge)} marked Returned`;
  } else {
    const now = new Date();
    const dueBack = new Date(
      now.getTime() + (settings.breakMinutes + settings.lateGrace) * 60000
    );

    breakData.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      badge,
      name: name || "Unknown",
      startTime: now.toISOString(),
      dueBack: dueBack.toISOString(),
      returnTime: "",
      status: "On Break"
    });

    elements.lastScan.innerHTML =
      `<strong>Last Scan:</strong> ${escapeHtml(badge)} started break`;
  }

  saveData();
  renderTable();

  elements.badgeInput.value = "";
  elements.nameInput.value = "";
  elements.badgeInput.focus();
}

function getStatus(item) {
  if (item.status === "Returned") {
    return "Returned";
  }

  return new Date() > new Date(item.dueBack) ? "Late" : "On Break";
}

function getStatusClass(status) {
  if (status === "Late") {
    return "status-late";
  }

  if (status === "Returned") {
    return "status-returned";
  }

  return "status-on-break";
}

function formatTime(dateString) {
  if (!dateString) {
    return "-";
  }

  return new Date(dateString).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderTable() {
  elements.breakTableBody.innerHTML = "";

  let onBreakCount = 0;
  let lateCount = 0;
  let returnedCount = 0;

  breakData.forEach((item, index) => {
    const status = getStatus(item);
    item.status = status;

    if (status === "On Break") onBreakCount += 1;
    if (status === "Late") lateCount += 1;
    if (status === "Returned") returnedCount += 1;

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${escapeHtml(item.badge)}</td>
      <td>${escapeHtml(item.name)}</td>
      <td>${formatTime(item.startTime)}</td>
      <td>${formatTime(item.dueBack)}</td>
      <td>${formatTime(item.returnTime)}</td>
      <td>
        <span class="status-pill ${getStatusClass(status)}">
          ${status}
        </span>
      </td>
      <td>
        ${
          status !== "Returned"
            ? `<button type="button" data-action="return" data-index="${index}">Return</button>`
            : `<button type="button" class="btn-danger" data-action="delete" data-index="${index}">Delete</button>`
        }
      </td>
    `;

    elements.breakTableBody.appendChild(row);
  });

  elements.onBreakCount.textContent = onBreakCount;
  elements.lateCount.textContent = lateCount;
  elements.returnedCount.textContent = returnedCount;
  elements.totalCount.textContent = breakData.length;

  saveData();
}

function markReturned(index) {
  breakData[index].returnTime = new Date().toISOString();
  breakData[index].status = "Returned";

  saveData();
  renderTable();
  elements.badgeInput.focus();
}

function deleteRow(index) {
  if (!confirm("Delete this row?")) {
    return;
  }

  breakData.splice(index, 1);

  saveData();
  renderTable();
  elements.badgeInput.focus();
}

function clearAllData() {
  if (!confirm("Clear all break tracker data?")) {
    return;
  }

  breakData = [];

  saveData();
  renderTable();
  elements.badgeInput.focus();
}

function downloadData() {
  const exportObject = {
    app: "Break Time Tracker",
    version: "1.0.0",
    permissionsTeamUrl: PERMISSIONS_TEAM_URL,
    exportedAt: new Date().toISOString(),
    settings,
    breakData
  };

  const dataStr = JSON.stringify(exportObject, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "break-tracker-data.json";
  link.click();

  URL.revokeObjectURL(link.href);
  elements.badgeInput.focus();
}

function uploadData(event) {
  const file = event.target.files[0];

  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.onload = eventData => {
    try {
      const uploadedData = JSON.parse(eventData.target.result);

      if (Array.isArray(uploadedData)) {
        breakData = uploadedData;
      } else {
        breakData = uploadedData.breakData || [];
        settings = uploadedData.settings || settings;
      }

      saveData();
      writeJson(STORAGE_KEYS.settings, settings);
      loadSettingsIntoPage();
      renderTable();

      alert("Data uploaded successfully.");
      elements.badgeInput.focus();
    } catch {
      alert("Could not read file.");
    } finally {
      elements.uploadFile.value = "";
    }
  };

  reader.readAsText(file);
}

function openSettings() {
  loadSettingsIntoPage();
  elements.settingsModal.classList.add("show");
}

function closeSettings() {
  elements.settingsModal.classList.remove("show");
  setTimeout(() => elements.badgeInput.focus(), 100);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function bindEvents() {
  elements.continueButton.addEventListener("click", continueToApp);
  elements.settingsButton.addEventListener("click", openSettings);
  elements.closeSettingsButton.addEventListener("click", closeSettings);
  elements.cancelSettingsButton.addEventListener("click", closeSettings);
  elements.saveSettingsButton.addEventListener("click", saveSettings);

  elements.downloadButton.addEventListener("click", downloadData);
  elements.uploadButton.addEventListener("click", () => elements.uploadFile.click());
  elements.uploadFile.addEventListener("change", uploadData);
  elements.clearButton.addEventListener("click", clearAllData);

  elements.badgeInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      scanBadge();
    }
  });

  elements.nameInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      elements.badgeInput.focus();
    }
  });

  elements.breakTableBody.addEventListener("click", event => {
    const button = event.target.closest("button");

    if (!button) {
      return;
    }

    const index = Number(button.dataset.index);

    if (button.dataset.action === "return") {
      markReturned(index);
    }

    if (button.dataset.action === "delete") {
      deleteRow(index);
    }
  });

  elements.settingsModal.addEventListener("click", event => {
    if (event.target.id === "settingsModal") {
      closeSettings();
    }
  });
}

function init() {
  bindEvents();
  loadSettingsIntoPage();
  updateHeaderClock();
  renderTable();
  checkAccessGate();

  setInterval(updateHeaderClock, 1000);
  setInterval(renderTable, 10000);
}

init();
