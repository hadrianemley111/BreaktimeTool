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

const el = {
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
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallbackValue;
  } catch (error) {
    return fallbackValue;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function saveData() {
  writeJson(STORAGE_KEYS.data, breakData);
}

function saveSettingsOnly() {
  writeJson(STORAGE_KEYS.settings, settings);
}

function isSlackReady() {
  return Boolean(settings.slackEnabled && settings.slackWebhookUrl.trim());
}

function loadSettingsIntoPage() {
  el.breakMinutes.value = String(settings.breakMinutes);
  el.lateGrace.value = String(settings.lateGrace);
  el.slackEnabled.checked = Boolean(settings.slackEnabled);
  el.slackWebhookUrl.value = settings.slackWebhookUrl || "";
  el.summaryBreak.textContent = settings.breakMinutes;
  el.summaryGrace.textContent = settings.lateGrace;
  el.summarySlack.textContent = isSlackReady() ? "On" : "Off";
  el.slackStatus.textContent = isSlackReady() ? "Slack On" : "Slack Off";
  el.slackStatus.classList.toggle("on", isSlackReady());
  el.slackStatus.classList.toggle("off", !isSlackReady());
}

function saveSettingsFromForm() {
  settings.breakMinutes = Number(el.breakMinutes.value);
  settings.lateGrace = Number(el.lateGrace.value);
  settings.slackEnabled = el.slackEnabled.checked;
  settings.slackWebhookUrl = el.slackWebhookUrl.value.trim();
  saveSettingsOnly();
  loadSettingsIntoPage();
}

function saveSettingsAndClose() {
  saveSettingsFromForm();
  closeSettings();
}

function focusScanner() {
  setTimeout(() => el.badgeInput.focus(), 100);
}

function updateHeaderClock() {
  const now = new Date();
  el.currentDate.textContent = now.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
  el.currentTime.textContent = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

async function scanBadge() {
  const badge = el.badgeInput.value.trim();
  const name = el.nameInput.value.trim();

  if (!badge) {
    focusScanner();
    return;
  }

  const activeBreak = breakData.find(item => item.badge === badge && !item.returnTime);

  if (activeBreak) {
    activeBreak.returnTime = new Date().toISOString();

    const minutesLate = getMinutesLateAtReturn(activeBreak);

    if (minutesLate > 0) {
      activeBreak.status = "Late";
      activeBreak.lateMinutes = minutesLate;
      setLastScan(`${escapeHtml(badge)} returned late by ${minutesLate} min`);
      await sendReturnedLateAlert(activeBreak);
    } else {
      activeBreak.status = "Returned";
      setLastScan(`${escapeHtml(badge)} marked Returned`);
    }
  } else {
    const now = new Date();
    const dueBack = new Date(now.getTime() + (settings.breakMinutes + settings.lateGrace) * 60000);

    breakData.push({
      id: getId(),
      badge,
      name: name || "Unknown",
      startTime: now.toISOString(),
      dueBack: dueBack.toISOString(),
      returnTime: "",
      status: "On Break",
      slackLateNotified: false,
      lateAlertSent: false,
      returnLateAlertSent: false,
      lateMinutes: 0
    });

    setLastScan(`${escapeHtml(badge)} started break`);
  }

  el.badgeInput.value = "";
  el.nameInput.value = "";
  saveData();
  renderTable();
  focusScanner();
}

function getId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return String(Date.now()) + String(Math.random()).slice(2);
}

function setLastScan(message) {
  el.lastScan.innerHTML = `<strong>Last Scan:</strong> ${message}`;
}

function getStatus(item) {
  const dueBack = new Date(item.dueBack);
  const returned = item.returnTime ? new Date(item.returnTime) : null;

  if (returned && !Number.isNaN(returned.getTime())) {
    if (!Number.isNaN(dueBack.getTime()) && returned > dueBack) {
      return "Late";
    }

    return "Returned";
  }

  return new Date() > dueBack ? "Late" : "On Break";
}

function getStatusClass(status) {
  if (status === "Late") return "status-late";
  if (status === "Returned") return "status-returned";
  return "status-on-break";
}

function formatTime(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getMinutesLate(item) {
  const dueBack = new Date(item.dueBack);
  if (Number.isNaN(dueBack.getTime())) return 0;

  const compareTime = item.returnTime ? new Date(item.returnTime) : new Date();
  if (Number.isNaN(compareTime.getTime())) return 0;

  return Math.max(0, Math.ceil((compareTime - dueBack) / 60000));
}

function getMinutesLateAtReturn(item) {
  if (!item.returnTime) return 0;
  return getMinutesLate(item);
}

function isReturnedLate(item) {
  return Boolean(item.returnTime && getMinutesLateAtReturn(item) > 0);
}

function renderTable() {
  el.breakTableBody.innerHTML = "";

  let onBreakCount = 0;
  let lateCount = 0;
  let returnedCount = 0;

  breakData.forEach((item, index) => {
    item.slackLateNotified = Boolean(item.slackLateNotified || item.lateAlertSent);
    const status = getStatus(item);
    item.status = status;

    if (status === "On Break") onBreakCount += 1;
    if (status === "Late") lateCount += 1;
    if (status === "Returned") returnedCount += 1;

    const returnedLate = isReturnedLate(item);
    const returnedCellClass = returnedLate ? "return-late" : "";
    const rowClass = returnedLate ? "late-returned-row" : "";

    const row = document.createElement("tr");
    row.className = rowClass;
    row.innerHTML = `
      <td>${escapeHtml(item.badge)}</td>
      <td>${escapeHtml(item.name)}</td>
      <td>${formatTime(item.startTime)}</td>
      <td>${formatTime(item.dueBack)}</td>
      <td class="${returnedCellClass}">${formatTime(item.returnTime)}</td>
      <td><span class="status-pill ${getStatusClass(status)}">${status}</span></td>
      <td>${!item.returnTime
        ? `<button type="button" data-action="return" data-index="${index}">Return</button>`
        : `<button type="button" class="btn-danger" data-action="delete" data-index="${index}">Delete</button>`}
      </td>
    `;
    el.breakTableBody.appendChild(row);
  });

  el.onBreakCount.textContent = onBreakCount;
  el.lateCount.textContent = lateCount;
  el.returnedCount.textContent = returnedCount;
  el.totalCount.textContent = breakData.length;
  saveData();
}

async function markReturned(index) {
  const item = breakData[index];
  if (!item) return;

  item.returnTime = new Date().toISOString();

  const minutesLate = getMinutesLateAtReturn(item);

  if (minutesLate > 0) {
    item.status = "Late";
    item.lateMinutes = minutesLate;
    await sendReturnedLateAlert(item);
  } else {
    item.status = "Returned";
  }

  saveData();
  renderTable();
  focusScanner();
}

function deleteRow(index) {
  if (!confirm("Delete this row?")) return;
  breakData.splice(index, 1);
  saveData();
  renderTable();
  focusScanner();
}

function clearAllData() {
  if (!confirm("Clear all break tracker data?")) return;
  breakData = [];
  saveData();
  renderTable();
  focusScanner();
}

function downloadData() {
  const exportObject = {
    app: "Break Time Tracker",
    version: "1.4.0",
    exportedAt: new Date().toISOString(),
    settings: {
      breakMinutes: settings.breakMinutes,
      lateGrace: settings.lateGrace,
      slackEnabled: settings.slackEnabled
    },
    breakData
  };

  const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `break-tracker-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  el.lastScan.innerHTML = "<strong>Data:</strong> Download started.";
  focusScanner();
}

function openUploadPicker() {
  el.uploadFile.value = "";
  el.uploadFile.click();
}

function uploadData(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const uploaded = JSON.parse(evt.target.result);
      let importedRows = [];

      if (Array.isArray(uploaded)) {
        importedRows = uploaded;
      } else if (Array.isArray(uploaded.breakData)) {
        importedRows = uploaded.breakData;
        if (uploaded.settings) {
          settings.breakMinutes = Number(uploaded.settings.breakMinutes ?? settings.breakMinutes);
          settings.lateGrace = Number(uploaded.settings.lateGrace ?? settings.lateGrace);
        }
      } else {
        throw new Error("Invalid data format");
      }

      breakData = importedRows.map(normalizeRow);
      saveData();
      saveSettingsOnly();
      loadSettingsIntoPage();
      renderTable();
      el.lastScan.innerHTML = `<strong>Data:</strong> Uploaded ${breakData.length} rows.`;
      alert(`Data uploaded successfully. Rows loaded: ${breakData.length}`);
    } catch (error) {
      console.error(error);
      alert("Could not read file. Make sure it is a valid break tracker JSON file.");
    } finally {
      el.uploadFile.value = "";
      focusScanner();
    }
  };
  reader.onerror = () => alert("Could not read file.");
  reader.readAsText(file);
}

function normalizeRow(item) {
  const row = {
    id: item.id || getId(),
    badge: String(item.badge || ""),
    name: item.name || "Unknown",
    startTime: item.startTime || new Date().toISOString(),
    dueBack: item.dueBack || new Date().toISOString(),
    returnTime: item.returnTime || "",
    status: item.status || "On Break",
    slackLateNotified: Boolean(item.slackLateNotified || item.lateAlertSent),
    lateAlertSent: Boolean(item.lateAlertSent || item.slackLateNotified),
    returnLateAlertSent: Boolean(item.returnLateAlertSent),
    lateMinutes: Number(item.lateMinutes || 0)
  };

  row.status = getStatus(row);
  if (isReturnedLate(row)) {
    row.lateMinutes = getMinutesLateAtReturn(row);
  }

  return row;
}

function getLatePeople() {
  return breakData.filter(item => getStatus(item) === "Late");
}

function slackTextPayload(message) {
  /*
    Slack Workflow Builder is set up with ONE webhook variable:
      Key: message
      Type: Text

    Keep the payload to ONLY this field. Do not add text, name, badge,
    dueBack, or other fields, or Slack may post the wrong variable.
  */
  return {
    message: message
  };
}

function buildReturnedLatePayload(item) {
  const name = item.name && item.name !== "Unknown" ? item.name : "Unknown name";
  const minutesLate = getMinutesLateAtReturn(item);

  const message = [
    "🚨 Late From Break Return",
    `Name: ${name}`,
    `Badge: ${item.badge}`,
    `Due Back: ${formatTime(item.dueBack)}`,
    `Returned: ${formatTime(item.returnTime)}`,
    `Minutes Late: ${minutesLate}`
  ].join("\n");

  return slackTextPayload(message);
}

function buildLateListPayload() {
  const latePeople = getLatePeople();

  if (latePeople.length === 0) {
    return slackTextPayload("✅ No one is late from break.");
  }

  const lines = latePeople.map(item => {
    const name = item.name && item.name !== "Unknown" ? item.name : "Unknown name";
    const returnedText = item.returnTime ? ` | Returned ${formatTime(item.returnTime)}` : " | Still out";
    return `• ${name} | Badge ${item.badge} | Due ${formatTime(item.dueBack)}${returnedText} | ${getMinutesLate(item)} min late`;
  });

  return slackTextPayload(`🚨 Late From Break List (${latePeople.length})\n${lines.join("\n")}`);
}

async function sendSlackPayload(payload) {
  if (!isSlackReady()) {
    el.lastScan.innerHTML = "<strong>Slack:</strong> Add webhook URL and enable Slack in Settings.";
    return false;
  }

  /*
    GitHub Pages is a static site. Slack workflow webhooks may not allow
    normal browser CORS responses, so this uses no-cors to send the request
    without breaking the page. Open DevTools > Console to see the exact body
    being sent.
  */
  console.log("Sending Slack payload:", payload);

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

async function sendReturnedLateAlert(item) {
  if (!isSlackReady()) return false;
  if (!isReturnedLate(item)) return false;
  if (item.returnLateAlertSent) return false;

  item.returnLateAlertSent = true;
  item.lateMinutes = getMinutesLateAtReturn(item);

  return sendSlackPayload(buildReturnedLatePayload(item));
}

async function sendLateListToSlack() {
  const sent = await sendSlackPayload(buildLateListPayload());
  el.lastScan.innerHTML = sent
    ? "<strong>Slack:</strong> Late list sent."
    : "<strong>Slack:</strong> Could not send late list.";
  focusScanner();
}

async function testSlack() {
  saveSettingsFromForm();
  const sent = await sendSlackPayload(slackTextPayload("Slack connected"));

  el.lastScan.innerHTML = sent
    ? "<strong>Slack:</strong> Test sent. Slack should say Slack connected."
    : "<strong>Slack:</strong> Test failed. Check the webhook URL.";

  alert(sent ? "Slack connected test sent." : "Slack test failed. Check the webhook URL.");
  focusScanner();
}

function openSettings() {
  loadSettingsIntoPage();
  el.settingsModal.classList.add("show");
}

function closeSettings() {
  el.settingsModal.classList.remove("show");
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
  el.settingsButton.addEventListener("click", openSettings);
  el.closeSettingsButton.addEventListener("click", closeSettings);
  el.cancelSettingsButton.addEventListener("click", closeSettings);
  el.saveSettingsButton.addEventListener("click", saveSettingsAndClose);
  el.testSlackButton.addEventListener("click", testSlack);
  el.sendLateNowButton.addEventListener("click", sendLateListToSlack);
  el.downloadButton.addEventListener("click", downloadData);
  el.uploadButton.addEventListener("click", openUploadPicker);
  el.uploadFile.addEventListener("change", uploadData);
  el.clearButton.addEventListener("click", clearAllData);

  el.badgeInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      scanBadge();
    }
  });

  el.nameInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      focusScanner();
    }
  });

  el.breakTableBody.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    const index = Number(button.dataset.index);
    if (button.dataset.action === "return") markReturned(index);
    if (button.dataset.action === "delete") deleteRow(index);
  });

  el.settingsModal.addEventListener("click", event => {
    if (event.target === el.settingsModal) closeSettings();
  });
}

function init() {
  breakData = breakData.map(normalizeRow);
  bindEvents();
  loadSettingsIntoPage();
  updateHeaderClock();
  renderTable();
  focusScanner();
  setInterval(updateHeaderClock, 1000);
  setInterval(renderTable, 10000);
}

init();
