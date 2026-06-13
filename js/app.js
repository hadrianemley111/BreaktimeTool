const STORAGE_KEYS = {
  data: "breakTrackerData",
  settings: "breakTrackerSettings"
};

const DEFAULT_SETTINGS = {
  breakMinutes: 30,
  lateGrace: 5,
  slackEnabled: false,
  slackWebhookUrl: ""
};

let breakData = readJson(STORAGE_KEYS.data, []);
let settings = {
  ...DEFAULT_SETTINGS,
  ...readJson(STORAGE_KEYS.settings, DEFAULT_SETTINGS)
};

const elements = {
  currentDate: document.getElementById("currentDate"),
  currentTime: document.getElementById("currentTime"),
  slackStatus: document.getElementById("slackStatus"),

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
  testSlackButton: document.getElementById("testSlackButton"),
  sendLateNowButton: document.getElementById("sendLateNowButton"),

  breakMinutes: document.getElementById("breakMinutes"),
  lateGrace: document.getElementById("lateGrace"),
  slackEnabled: document.getElementById("slackEnabled"),
  slackWebhookUrl: document.getElementById("slackWebhookUrl"),

  summaryBreak: document.getElementById("summaryBreak"),
  summaryGrace: document.getElementById("summaryGrace"),
  summarySlack: document.getElementById("summarySlack"),

  downloadButton: document.getElementById("downloadButton"),
  uploadButton: document.getElementById("uploadButton"),
  uploadFile: document.getElementById("uploadFile"),
  clearButton: document.getElementById("clearButton")
};

function readJson(key, fallbackValue) {
  try {
    const rawValue = localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallbackValue;
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
  settings.slackEnabled = elements.slackEnabled.checked;
  settings.slackWebhookUrl = elements.slackWebhookUrl.value.trim();

  writeJson(STORAGE_KEYS.settings, settings);
  loadSettingsIntoPage();
  closeSettings();
}

function loadSettingsIntoPage() {
  elements.breakMinutes.value = String(settings.breakMinutes);
  elements.lateGrace.value = String(settings.lateGrace);
  elements.slackEnabled.checked = Boolean(settings.slackEnabled);
  elements.slackWebhookUrl.value = settings.slackWebhookUrl || "";

  elements.summaryBreak.textContent = settings.breakMinutes;
  elements.summaryGrace.textContent = settings.lateGrace;
  elements.summarySlack.textContent = isSlackReady() ? "On" : "Off";

  elements.slackStatus.textContent = isSlackReady() ? "Slack On" : "Slack Off";
  elements.slackStatus.classList.toggle("on", isSlackReady());
  elements.slackStatus.classList.toggle("off", !isSlackReady());
}

function isSlackReady() {
  return Boolean(settings.slackEnabled && settings.slackWebhookUrl);
}

function focusScanner() {
  setTimeout(() => elements.badgeInput.focus(), 100);
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
      status: "On Break",
      slackLateNotified: false
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
  if (status === "Late") return "status-late";
  if (status === "Returned") return "status-returned";
  return "status-on-break";
}

function formatTime(dateString) {
  if (!dateString) return "-";

  return new Date(dateString).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getMinutesLate(item) {
  const lateMs = new Date() - new Date(item.dueBack);
  return Math.max(0, Math.floor(lateMs / 60000));
}

function renderTable() {
  elements.breakTableBody.innerHTML = "";

  let onBreakCount = 0;
  let lateCount = 0;
  let returnedCount = 0;

  breakData.forEach((item, index) => {
    const oldStatus = item.status;
    const status = getStatus(item);
    item.status = status;

    if (status === "On Break") onBreakCount += 1;
    if (status === "Late") lateCount += 1;
    if (status === "Returned") returnedCount += 1;

    if (status === "Late" && oldStatus !== "Late" && !item.slackLateNotified) {
      sendSlackLateAlert(item);
      item.slackLateNotified = true;
    }

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
  if (!confirm("Delete this row?")) return;

  breakData.splice(index, 1);
  saveData();
  renderTable();
  elements.badgeInput.focus();
}

function clearAllData() {
  if (!confirm("Clear all break tracker data?")) return;

  breakData = [];
  saveData();
  renderTable();
  elements.badgeInput.focus();
}

function downloadData() {
  const exportObject = {
    app: "Break Time Tracker",
    version: "1.2.0",
    exportedAt: new Date().toISOString(),
    settings: {
      ...settings,
      slackWebhookUrl: "REMOVED_FOR_SECURITY"
    },
    breakData
  };

  const dataStr = JSON.stringify(exportObject, null, 2);
  const blob = new Blob([dataStr], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  const timestamp = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `break-tracker-data-${timestamp}.json`;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
  elements.lastScan.innerHTML = "<strong>Data:</strong> Download started.";
  elements.badgeInput.focus();
}

function uploadData(event) {
  const file = event.target.files[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = eventData => {
    try {
      const uploadedData = JSON.parse(eventData.target.result);

      if (Array.isArray(uploadedData)) {
        breakData = uploadedData;
      } else {
        breakData = Array.isArray(uploadedData.breakData) ? uploadedData.breakData : [];
        if (uploadedData.settings) {
          settings = {
            ...settings,
            breakMinutes: uploadedData.settings.breakMinutes ?? settings.breakMinutes,
            lateGrace: uploadedData.settings.lateGrace ?? settings.lateGrace
          };
        }
      }

      breakData = breakData.map(item => ({
        id: item.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())),
        badge: item.badge || "",
        name: item.name || "Unknown",
        startTime: item.startTime || new Date().toISOString(),
        dueBack: item.dueBack || new Date().toISOString(),
        returnTime: item.returnTime || "",
        status: item.status || "On Break",
        slackLateNotified: Boolean(item.slackLateNotified)
      }));

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

function getLatePeople() {
  return breakData.filter(item => getStatus(item) === "Late");
}

function buildSingleLatePayload(item) {
  const name = item.name && item.name !== "Unknown" ? item.name : "Unknown name";
  const minutesLate = getMinutesLate(item);

  return {
    text:
      `:rotating_light: Break late alert\n` +
      `*Name:* ${name}\n` +
      `*Badge:* ${item.badge}\n` +
      `*Due back:* ${formatTime(item.dueBack)}\n` +
      `*Minutes late:* ${minutesLate}`
  };
}

function buildLateListPayload() {
  const latePeople = getLatePeople();

  if (latePeople.length === 0) {
    return {
      text: ":white_check_mark: No one is currently late from break."
    };
  }

  const lines = latePeople.map(item => {
    const name = item.name && item.name !== "Unknown" ? item.name : "Unknown name";
    return `• ${name} | Badge ${item.badge} | Due ${formatTime(item.dueBack)} | ${getMinutesLate(item)} min late`;
  });

  return {
    text: `:rotating_light: Current late break list (${latePeople.length})\n${lines.join("\n")}`
  };
}

async function sendSlackPayload(payload) {
  if (!isSlackReady()) {
    elements.lastScan.innerHTML =
      "<strong>Slack:</strong> Add a webhook URL in Settings first.";
    return false;
  }

  try {
    await fetch(settings.slackWebhookUrl, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify(payload)
    });

    return true;
  } catch (error) {
    console.error("Slack webhook failed", error);
    return false;
  }
}

async function sendSlackLateAlert(item) {
  if (!isSlackReady()) return;

  await sendSlackPayload(buildSingleLatePayload(item));
}

async function sendLateListToSlack() {
  const sent = await sendSlackPayload(buildLateListPayload());

  elements.lastScan.innerHTML = sent
    ? "<strong>Slack:</strong> Late list sent."
    : "<strong>Slack:</strong> Could not send late list.";

  focusScanner();
}

async function testSlack() {
  saveSettings();

  const sent = await sendSlackPayload({
    text: ":white_check_mark: Slack connected"
  });

  elements.lastScan.innerHTML = sent
    ? "<strong>Slack:</strong> Test sent. Slack should say Slack connected."
    : "<strong>Slack:</strong> Test failed. Check the webhook URL.";

  alert(sent ? "Slack connected test sent." : "Slack test failed. Check the webhook URL.");
  focusScanner();
}

function openSettings() {
  loadSettingsIntoPage();
  elements.settingsModal.classList.add("show");
}

function closeSettings() {
  elements.settingsModal.classList.remove("show");
  focusScanner();
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
  elements.settingsButton.addEventListener("click", openSettings);
  elements.closeSettingsButton.addEventListener("click", closeSettings);
  elements.cancelSettingsButton.addEventListener("click", closeSettings);
  elements.saveSettingsButton.addEventListener("click", saveSettings);
  elements.testSlackButton.addEventListener("click", testSlack);
  elements.sendLateNowButton.addEventListener("click", sendLateListToSlack);

  elements.downloadButton.addEventListener("click", downloadData);
  elements.uploadButton.addEventListener("click", () => {
    elements.uploadFile.value = "";
    elements.uploadFile.click();
  });
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
    if (!button) return;

    const index = Number(button.dataset.index);

    if (button.dataset.action === "return") markReturned(index);
    if (button.dataset.action === "delete") deleteRow(index);
  });

  elements.settingsModal.addEventListener("click", event => {
    if (event.target.id === "settingsModal") closeSettings();
  });
}

function init() {
  bindEvents();
  loadSettingsIntoPage();
  updateHeaderClock();
  renderTable();
  focusScanner();

  setInterval(updateHeaderClock, 1000);
  setInterval(renderTable, 10000);
}

init();
