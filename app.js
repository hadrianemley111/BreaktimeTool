import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyBJVVdULL-UenML7ut9iMl6ACA_LLM4AaQ",
  authDomain: "kcvg-break-tracker.firebaseapp.com",
  projectId: "kcvg-break-tracker",
  storageBucket: "kcvg-break-tracker.firebasestorage.app",
  messagingSenderId: "498555651868",
  appId: "1:498555651868:web:738d3389f340c7381ddcd9"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const functions = getFunctions(firebaseApp, "us-central1");

const verifyDashboardCodeFunction = httpsCallable(functions, "verifyDashboardCode");
const sendBreakSlackFunction = httpsCallable(functions, "sendBreakSlack");
const clearDashboardAccessFunction = httpsCallable(functions, "clearDashboardAccess");

const DEFAULT_SETTINGS = {
  breakMinutes: 30,
  lateGrace: 5,
  slackEnabled: true
};

let breakData = [];
let settings = { ...DEFAULT_SETTINGS };
let activeDashboard = null;
let unsubscribeBreaks = null;
let unsubscribeSettings = null;
let lateCheckTimer = null;

const el = {
  loginScreen: document.getElementById("loginScreen"),
  dashboardCode: document.getElementById("dashboardCode"),
  loginButton: document.getElementById("loginButton"),
  loginMessage: document.getElementById("loginMessage"),
  app: document.getElementById("app"),
  dashboardLabel: document.getElementById("dashboardLabel"),
  exitButton: document.getElementById("exitButton"),
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
  summaryBreak: document.getElementById("summaryBreak"),
  summaryGrace: document.getElementById("summaryGrace"),
  summarySlack: document.getElementById("summarySlack"),
  downloadButton: document.getElementById("downloadButton"),
  uploadButton: document.getElementById("uploadButton"),
  uploadFile: document.getElementById("uploadFile"),
  clearButton: document.getElementById("clearButton")
};

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function getId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTime(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getStatus(item) {
  const dueBack = new Date(item.dueBack);
  const returned = item.returnTime ? new Date(item.returnTime) : null;

  if (returned && !Number.isNaN(returned.getTime())) {
    return returned > dueBack ? "Late" : "Returned";
  }

  return Date.now() > dueBack.getTime() ? "Late" : "On Break";
}

function getStatusClass(status) {
  if (status === "Late") return "status-late";
  if (status === "Returned") return "status-returned";
  return "status-on-break";
}

function getMinutesLate(item) {
  const dueBack = new Date(item.dueBack);
  if (Number.isNaN(dueBack.getTime())) return 0;

  const compareTime = item.returnTime ? new Date(item.returnTime) : new Date();
  if (Number.isNaN(compareTime.getTime())) return 0;

  return Math.max(0, Math.ceil((compareTime.getTime() - dueBack.getTime()) / 60000));
}

function normalizeRow(item) {
  return {
    id: String(item.id || getId()),
    badge: String(item.badge || ""),
    name: String(item.name || "Unknown"),
    startTime: item.startTime || new Date().toISOString(),
    dueBack: item.dueBack || new Date().toISOString(),
    returnTime: item.returnTime || "",
    lateAlertSent: Boolean(item.lateAlertSent),
    returnLateAlertSent: Boolean(item.returnLateAlertSent),
    lateMinutes: Number(item.lateMinutes || 0)
  };
}

function dashboardBreaksCollection() {
  if (!activeDashboard) throw new Error("No dashboard is open.");
  return collection(db, "dashboards", activeDashboard.id, "breaks");
}

function dashboardSettingsDocument() {
  if (!activeDashboard) throw new Error("No dashboard is open.");
  return doc(db, "dashboards", activeDashboard.id, "configuration", "settings");
}

function dashboardBreakDocument(recordId) {
  if (!activeDashboard) throw new Error("No dashboard is open.");
  return doc(db, "dashboards", activeDashboard.id, "breaks", String(recordId));
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

function updateSlackDisplay() {
  const ready = Boolean(settings.slackEnabled);
  el.summarySlack.textContent = ready ? "On" : "Off";
  el.slackStatus.textContent = ready ? "Slack On" : "Slack Off";
  el.slackStatus.classList.toggle("on", ready);
  el.slackStatus.classList.toggle("off", !ready);
}

function loadSettingsIntoPage() {
  el.breakMinutes.value = String(settings.breakMinutes);
  el.lateGrace.value = String(settings.lateGrace);
  el.slackEnabled.checked = Boolean(settings.slackEnabled);
  el.summaryBreak.textContent = settings.breakMinutes;
  el.summaryGrace.textContent = settings.lateGrace;
  updateSlackDisplay();
}

function setLastScan(message) {
  el.lastScan.innerHTML = `<strong>Last Scan:</strong> ${message}`;
}

function focusScanner() {
  setTimeout(() => el.badgeInput.focus(), 100);
}

function renderTable() {
  el.breakTableBody.innerHTML = "";

  let onBreakCount = 0;
  let lateCount = 0;
  let returnedCount = 0;

  const sorted = [...breakData].sort(
    (a, b) => new Date(b.startTime) - new Date(a.startTime)
  );

  if (sorted.length === 0) {
    el.breakTableBody.innerHTML =
      '<tr><td colspan="7" style="text-align:center;padding:28px;">No scans on this dashboard.</td></tr>';
  }

  for (const item of sorted) {
    const status = getStatus(item);

    if (status === "On Break") onBreakCount += 1;
    if (status === "Late") lateCount += 1;
    if (status === "Returned") returnedCount += 1;

    const returnedLate = Boolean(item.returnTime) && getMinutesLate(item) > 0;
    const row = document.createElement("tr");
    row.className = returnedLate ? "late-returned-row" : "";

    row.innerHTML = `
      <td>${escapeHtml(item.badge)}</td>
      <td>${escapeHtml(item.name)}</td>
      <td>${formatTime(item.startTime)}</td>
      <td>${formatTime(item.dueBack)}</td>
      <td class="${returnedLate ? "return-late" : ""}">${formatTime(item.returnTime)}</td>
      <td><span class="status-pill ${getStatusClass(status)}">${status}</span></td>
      <td>
        ${
          !item.returnTime
            ? `<button type="button" data-action="return" data-id="${escapeHtml(item.id)}">Return</button>`
            : `<button type="button" class="btn-danger" data-action="delete" data-id="${escapeHtml(item.id)}">Delete</button>`
        }
      </td>
    `;

    el.breakTableBody.appendChild(row);
  }

  el.onBreakCount.textContent = onBreakCount;
  el.lateCount.textContent = lateCount;
  el.returnedCount.textContent = returnedCount;
  el.totalCount.textContent = breakData.length;
}

async function openDashboard() {
  const code = normalizeCode(el.dashboardCode.value);

  if (!code) {
    el.loginMessage.textContent = "Enter a dashboard code.";
    return;
  }

  el.loginButton.disabled = true;
  el.loginButton.textContent = "Checking...";
  el.loginMessage.textContent = "";

  try {
    if (!auth.currentUser) await signInAnonymously(auth);

    const result = await verifyDashboardCodeFunction({ code });
    await auth.currentUser.getIdToken(true);

    activeDashboard = {
      id: result.data.dashboardId,
      name: result.data.dashboardName
    };

    sessionStorage.setItem(
      "breakTrackerDashboard",
      JSON.stringify(activeDashboard)
    );

    el.dashboardLabel.textContent = activeDashboard.name;
    el.loginScreen.classList.add("hidden");
    el.app.classList.remove("hidden");

    startDashboardListeners();
    focusScanner();
  } catch (error) {
    console.error(error);
    el.loginMessage.textContent =
      String(error.code || "").includes("permission-denied")
        ? "Invalid dashboard code."
        : error.message || "Could not open the dashboard.";
  } finally {
    el.loginButton.disabled = false;
    el.loginButton.textContent = "Open Dashboard";
  }
}

function stopDashboardListeners() {
  if (typeof unsubscribeBreaks === "function") unsubscribeBreaks();
  if (typeof unsubscribeSettings === "function") unsubscribeSettings();

  unsubscribeBreaks = null;
  unsubscribeSettings = null;

  if (lateCheckTimer) {
    clearInterval(lateCheckTimer);
    lateCheckTimer = null;
  }
}

function startDashboardListeners() {
  stopDashboardListeners();

  unsubscribeBreaks = onSnapshot(
    dashboardBreaksCollection(),
    snapshot => {
      breakData = snapshot.docs.map(snapshotDoc =>
        normalizeRow({ id: snapshotDoc.id, ...snapshotDoc.data() })
      );
      renderTable();
    },
    error => {
      console.error("Break sync failed:", error);
      setLastScan("Cloud sync failed. Refresh the page.");
    }
  );

  unsubscribeSettings = onSnapshot(
    dashboardSettingsDocument(),
    snapshot => {
      settings = snapshot.exists()
        ? { ...DEFAULT_SETTINGS, ...snapshot.data() }
        : { ...DEFAULT_SETTINGS };
      loadSettingsIntoPage();
    },
    error => console.error("Settings sync failed:", error)
  );

  lateCheckTimer = setInterval(checkForNewLatePeople, 15000);
}

async function scanBadge() {
  const badge = el.badgeInput.value.trim();
  const name = el.nameInput.value.trim();

  if (!badge || !activeDashboard) {
    focusScanner();
    return;
  }

  const activeBreak = breakData.find(
    item => item.badge === badge && !item.returnTime
  );

  try {
    if (activeBreak) {
      await markReturned(activeBreak.id);
      return;
    }

    const now = new Date();
    const dueBack = new Date(
      now.getTime() +
        (Number(settings.breakMinutes) + Number(settings.lateGrace)) * 60000
    );

    const recordId = getId();

    await setDoc(dashboardBreakDocument(recordId), {
      badge,
      name: name || "Unknown",
      startTime: now.toISOString(),
      dueBack: dueBack.toISOString(),
      returnTime: "",
      lateAlertSent: false,
      returnLateAlertSent: false,
      lateMinutes: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    setLastScan(`${escapeHtml(name || badge)} started break`);
  } catch (error) {
    console.error(error);
    alert(`Could not save scan: ${error.message}`);
  } finally {
    el.badgeInput.value = "";
    el.nameInput.value = "";
    focusScanner();
  }
}

async function markReturned(recordId) {
  const item = breakData.find(record => record.id === recordId);
  if (!item) return;

  const returnTime = new Date().toISOString();
  const updatedItem = { ...item, returnTime };
  const minutesLate = getMinutesLate(updatedItem);

  await setDoc(
    dashboardBreakDocument(recordId),
    {
      returnTime,
      lateMinutes: minutesLate,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  if (minutesLate > 0 && !item.returnLateAlertSent) {
    const sent = await sendReturnedLateAlert(updatedItem);

    if (sent) {
      await setDoc(
        dashboardBreakDocument(recordId),
        { returnLateAlertSent: true, updatedAt: serverTimestamp() },
        { merge: true }
      );
    }

    setLastScan(`${escapeHtml(item.name || item.badge)} returned ${minutesLate} min late`);
  } else {
    setLastScan(`${escapeHtml(item.name || item.badge)} marked Returned`);
  }

  focusScanner();
}

async function deleteRow(recordId) {
  if (!confirm("Delete this row?")) return;
  await deleteDoc(dashboardBreakDocument(recordId));
  focusScanner();
}

async function clearAllData() {
  if (!confirm(`Clear all data from ${activeDashboard?.name || "this dashboard"}?`)) return;

  const snapshot = await getDocs(dashboardBreaksCollection());

  for (let start = 0; start < snapshot.docs.length; start += 450) {
    const batch = writeBatch(db);
    snapshot.docs.slice(start, start + 450).forEach(snapshotDoc => {
      batch.delete(snapshotDoc.ref);
    });
    await batch.commit();
  }

  setLastScan("Dashboard cleared.");
  focusScanner();
}

async function saveSettingsAndClose() {
  settings = {
    breakMinutes: Number(el.breakMinutes.value),
    lateGrace: Number(el.lateGrace.value),
    slackEnabled: el.slackEnabled.checked
  };

  await setDoc(
    dashboardSettingsDocument(),
    { ...settings, updatedAt: serverTimestamp() },
    { merge: true }
  );

  closeSettings();
}

function openSettings() {
  loadSettingsIntoPage();
  el.settingsModal.classList.add("show");
}

function closeSettings() {
  el.settingsModal.classList.remove("show");
  focusScanner();
}

function buildReturnedLateMessage(item) {
  const name = item.name && item.name !== "Unknown" ? item.name : "Unknown name";

  return [
    "🚨 Late From Break Return",
    `Dashboard: ${activeDashboard.name}`,
    `Name: ${name}`,
    `Badge: ${item.badge}`,
    `Due Back: ${formatTime(item.dueBack)}`,
    `Returned: ${formatTime(item.returnTime)}`,
    `Minutes Late: ${getMinutesLate(item)}`
  ].join("\n");
}

function buildLateListMessage() {
  const latePeople = breakData.filter(item => getStatus(item) === "Late");

  if (latePeople.length === 0) {
    return `✅ No one is late from break on ${activeDashboard.name}.`;
  }

  const lines = latePeople.map(item => {
    const name = item.name && item.name !== "Unknown" ? item.name : "Unknown name";
    const returnedText = item.returnTime
      ? ` | Returned ${formatTime(item.returnTime)}`
      : " | Still out";

    return `• ${name} | Badge ${item.badge} | Due ${formatTime(item.dueBack)}${returnedText} | ${getMinutesLate(item)} min late`;
  });

  return [
    `🚨 Late From Break List — ${activeDashboard.name} (${latePeople.length})`,
    ...lines
  ].join("\n");
}

async function sendSlackMessage(message, showError = false) {
  if (!settings.slackEnabled) {
    if (showError) alert("Slack is disabled in Settings for this dashboard.");
    return false;
  }

  try {
    await sendBreakSlackFunction({ message });
    return true;
  } catch (error) {
    console.error("Secure Slack call failed:", error);
    if (showError) alert(error.message || "The Slack message could not be sent.");
    return false;
  }
}

async function sendReturnedLateAlert(item) {
  if (!settings.slackEnabled || getMinutesLate(item) <= 0) return false;
  return sendSlackMessage(buildReturnedLateMessage(item));
}

async function sendLateListToSlack() {
  const sent = await sendSlackMessage(buildLateListMessage(), true);
  setLastScan(sent ? "Late list sent to Slack." : "Could not send late list.");
  focusScanner();
}

async function testSlack() {
  settings.slackEnabled = el.slackEnabled.checked;

  if (!settings.slackEnabled) {
    alert("Check the Slack enabled box first.");
    return;
  }

  const sent = await sendSlackMessage(
    `Slack connected for ${activeDashboard.name}.`,
    true
  );

  setLastScan(sent ? "Slack test sent." : "Slack test failed.");
  if (sent) alert(`Slack connected for ${activeDashboard.name}.`);
  focusScanner();
}

async function checkForNewLatePeople() {
  if (!activeDashboard || !settings.slackEnabled) {
    renderTable();
    return;
  }

  const newlyLate = breakData.filter(
    item => !item.returnTime && getStatus(item) === "Late" && !item.lateAlertSent
  );

  for (const item of newlyLate) {
    const sent = await sendSlackMessage(
      [
        "🚨 Late From Break",
        `Dashboard: ${activeDashboard.name}`,
        `Name: ${item.name || "Unknown"}`,
        `Badge: ${item.badge}`,
        `Due Back: ${formatTime(item.dueBack)}`,
        `Minutes Late: ${getMinutesLate(item)}`
      ].join("\n")
    );

    if (sent) {
      await setDoc(
        dashboardBreakDocument(item.id),
        { lateAlertSent: true, updatedAt: serverTimestamp() },
        { merge: true }
      );
    }
  }

  renderTable();
}

function downloadData() {
  const exportObject = {
    app: "Break Time Tracker",
    version: "2.0.0",
    dashboard: activeDashboard,
    exportedAt: new Date().toISOString(),
    settings,
    breakData
  };

  const blob = new Blob(
    [JSON.stringify(exportObject, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${activeDashboard.id}-break-tracker-${new Date().toISOString().slice(0, 10)}.json`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1500);
  setLastScan("Download started.");
  focusScanner();
}

function openUploadPicker() {
  el.uploadFile.value = "";
  el.uploadFile.click();
}

function uploadData(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = async loadEvent => {
    try {
      const uploaded = JSON.parse(loadEvent.target.result);
      const importedRows = Array.isArray(uploaded) ? uploaded : uploaded.breakData;

      if (!Array.isArray(importedRows)) {
        throw new Error("Invalid data format.");
      }

      if (!confirm(`Upload ${importedRows.length} rows into ${activeDashboard.name}?`)) {
        return;
      }

      for (let start = 0; start < importedRows.length; start += 450) {
        const batch = writeBatch(db);

        importedRows
          .slice(start, start + 450)
          .map(normalizeRow)
          .forEach(row => {
            const cleanRow = { ...row };
            delete cleanRow.id;

            batch.set(
              dashboardBreakDocument(row.id),
              { ...cleanRow, updatedAt: serverTimestamp() },
              { merge: true }
            );
          });

        await batch.commit();
      }

      if (uploaded.settings) {
        await setDoc(
          dashboardSettingsDocument(),
          {
            breakMinutes: Number(uploaded.settings.breakMinutes ?? settings.breakMinutes),
            lateGrace: Number(uploaded.settings.lateGrace ?? settings.lateGrace),
            slackEnabled: Boolean(uploaded.settings.slackEnabled ?? settings.slackEnabled),
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
      }

      setLastScan(`Uploaded ${importedRows.length} rows.`);
      alert("Data uploaded successfully.");
    } catch (error) {
      console.error(error);
      alert("Could not read the file. Make sure it is a valid break tracker JSON file.");
    } finally {
      el.uploadFile.value = "";
      focusScanner();
    }
  };

  reader.readAsText(file);
}

async function exitDashboard() {
  stopDashboardListeners();

  try {
    if (auth.currentUser) await clearDashboardAccessFunction();
  } catch (error) {
    console.error("Could not clear dashboard access:", error);
  }

  activeDashboard = null;
  breakData = [];
  settings = { ...DEFAULT_SETTINGS };

  sessionStorage.removeItem("breakTrackerDashboard");
  await signOut(auth);

  el.app.classList.add("hidden");
  el.loginScreen.classList.remove("hidden");
  el.dashboardCode.value = "";
  el.loginMessage.textContent = "";
  el.dashboardCode.focus();
}

function bindEvents() {
  el.loginButton.addEventListener("click", openDashboard);

  el.dashboardCode.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      openDashboard();
    }
  });

  el.exitButton.addEventListener("click", exitDashboard);
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

    const recordId = button.dataset.id;

    if (button.dataset.action === "return") markReturned(recordId);
    if (button.dataset.action === "delete") deleteRow(recordId);
  });

  el.settingsModal.addEventListener("click", event => {
    if (event.target === el.settingsModal) closeSettings();
  });
}

async function restoreDashboard(user) {
  const saved = sessionStorage.getItem("breakTrackerDashboard");
  if (!user || !saved || activeDashboard) return;

  try {
    const tokenResult = await user.getIdTokenResult(true);
    const dashboardId = tokenResult.claims.dashboardId;
    const dashboardName = tokenResult.claims.dashboardName;

    if (!dashboardId) {
      sessionStorage.removeItem("breakTrackerDashboard");
      return;
    }

    const savedDashboard = JSON.parse(saved);

    if (savedDashboard.id !== dashboardId) {
      sessionStorage.removeItem("breakTrackerDashboard");
      return;
    }

    activeDashboard = {
      id: dashboardId,
      name: dashboardName || savedDashboard.name
    };

    el.dashboardLabel.textContent = activeDashboard.name;
    el.loginScreen.classList.add("hidden");
    el.app.classList.remove("hidden");

    startDashboardListeners();
    focusScanner();
  } catch (error) {
    console.error("Could not restore dashboard:", error);
    sessionStorage.removeItem("breakTrackerDashboard");
  }
}

function init() {
  bindEvents();
  loadSettingsIntoPage();
  updateHeaderClock();
  setInterval(updateHeaderClock, 1000);
  setInterval(renderTable, 1000);
  onAuthStateChanged(auth, restoreDashboard);
  el.dashboardCode.focus();
}

init();
