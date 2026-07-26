import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBJVVdULL-UenML7ut9iMl6ACA_LLM4AaQ",
  authDomain: "kcvg-break-tracker.firebaseapp.com",
  projectId: "kcvg-break-tracker",
  storageBucket: "kcvg-break-tracker.firebasestorage.app",
  messagingSenderId: "498555651868",
  appId: "1:498555651868:web:738d3389f340c7381ddcd9"
};

const MINIMUM_BREAK_MS = 5 * 60 * 1000;
const RESULT_DISPLAY_MS = 3500;

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const params = new URLSearchParams(window.location.search);
const dashboardId = params.get("dashboard");
const dashboardName = params.get("name") || "Break Kiosk";

const el = {
  dashboardName: document.getElementById("dashboardName"),
  badgeInput: document.getElementById("badgeInput"),
  nameInput: document.getElementById("nameInput"),
  returnButton: document.getElementById("returnButton"),
  currentTime: document.getElementById("currentTime"),
  currentDate: document.getElementById("currentDate"),
  successTitle: document.getElementById("successTitle"),
  successMessage: document.getElementById("successMessage"),
  earlyMessage: document.getElementById("earlyMessage"),
  countdown: document.getElementById("countdown"),
  errorMessage: document.getElementById("errorMessage")
};

const screens = {
  home: document.getElementById("homeScreen"),
  waiting: document.getElementById("waitingScreen"),
  success: document.getElementById("successScreen"),
  early: document.getElementById("earlyScreen"),
  error: document.getElementById("errorScreen")
};

let isProcessing = false;
let countdownTimer = null;
let resetTimer = null;

function showScreen(name) {
  Object.values(screens).forEach(screen => screen.classList.remove("active"));
  screens[name].classList.add("active");
}

function focusScanner() {
  setTimeout(() => el.badgeInput.focus(), 50);
}

function resetToHome(delay = 0) {
  clearTimeout(resetTimer);

  resetTimer = setTimeout(() => {
    clearInterval(countdownTimer);
    el.badgeInput.value = "";
    el.nameInput.value = "";
    isProcessing = false;
    showScreen("home");
    focusScanner();
  }, delay);
}

function updateClock() {
  const now = new Date();

  el.currentTime.textContent = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  el.currentDate.textContent = now.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

function getId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function dashboardBreaksCollection() {
  return collection(db, "dashboards", dashboardId, "breaks");
}

function dashboardBreakDocument(recordId) {
  return doc(db, "dashboards", dashboardId, "breaks", String(recordId));
}

function dashboardSettingsDocument() {
  return doc(db, "dashboards", dashboardId, "configuration", "settings");
}

function friendlyName(record, badge) {
  const name = String(record?.name || "").trim();
  return name && name.toLowerCase() !== "unknown" ? name : `Badge ${badge}`;
}

function showSuccess(title, message) {
  el.successTitle.textContent = title;
  el.successMessage.textContent = message;
  showScreen("success");
  resetToHome(RESULT_DISPLAY_MS);
}

function showError(message) {
  el.errorMessage.textContent = message;
  showScreen("error");
  resetToHome(4500);
}

function showEarlyReturn(name, earliestReturnAt) {
  // Cancel any timer left over from another result screen.
  clearTimeout(resetTimer);
  clearInterval(countdownTimer);

  el.earlyMessage.textContent =
    `${name}, please wait at least five minutes before scanning back in.`;

  const updateCountdown = () => {
    const remainingMs = Math.max(0, earliestReturnAt - Date.now());
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    el.countdown.textContent = remainingMs > 0
      ? `Try again in ${minutes}:${String(seconds).padStart(2, "0")}`
      : "You may scan back in now.";
  };

  showScreen("early");
  updateCountdown();
  countdownTimer = setInterval(updateCountdown, 250);

  // This screen must always close after exactly three seconds.
  resetTimer = setTimeout(() => {
    clearInterval(countdownTimer);
    countdownTimer = null;
    el.badgeInput.value = "";
    if (el.nameInput) el.nameInput.value = "";
    isProcessing = false;
    showScreen("home");
    focusScanner();
  }, 3000);
}

async function getDashboardData() {
  const [breakSnapshot, settingsSnapshot] = await Promise.all([
    getDocs(dashboardBreaksCollection()),
    import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js")
      .then(({ getDoc }) => getDoc(dashboardSettingsDocument()))
  ]);

  const breaks = breakSnapshot.docs.map(snapshotDoc => ({
    id: snapshotDoc.id,
    ...snapshotDoc.data()
  }));

  const settings = settingsSnapshot.exists()
    ? settingsSnapshot.data()
    : {};

  return { breaks, settings };
}

async function processScan(badge, scannedName = "") {
  if (!dashboardId) {
    showError("This kiosk was not opened from a dashboard.");
    return;
  }

  showScreen("waiting");

  try {
    const { breaks, settings } = await getDashboardData();

    const activeBreak = breaks.find(item =>
      String(item.badge || "") === badge && !item.returnTime
    );

    const badgeRecords = [...breaks]
      .filter(item => String(item.badge || "") === badge)
      .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

    const previousRecord = badgeRecords[0];
    const namedRecord = badgeRecords.find(item => {
      const savedName = String(item.name || "").trim();
      return savedName && savedName.toLowerCase() !== "unknown";
    });

    const resolvedName = String(scannedName || "").trim() ||
      String(namedRecord?.name || "").trim();

    if (activeBreak) {
      const startTime = new Date(activeBreak.startTime).getTime();

      if (!Number.isFinite(startTime)) {
        throw new Error("The existing break has an invalid start time.");
      }

      const earliestReturnAt = startTime + MINIMUM_BREAK_MS;
      const name = resolvedName || friendlyName(activeBreak, badge);

      if (Date.now() < earliestReturnAt) {
        showEarlyReturn(name, earliestReturnAt);
        return;
      }

      const returnTime = new Date();
      const dueBack = new Date(activeBreak.dueBack);
      const minutesLate = Number.isFinite(dueBack.getTime())
        ? Math.max(0, Math.ceil((returnTime.getTime() - dueBack.getTime()) / 60000))
        : 0;

      await setDoc(
        dashboardBreakDocument(activeBreak.id),
        {
          returnTime: returnTime.toISOString(),
          lateMinutes: minutesLate,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      showSuccess(
        `Thank you, ${name}!`,
        minutesLate > 0
          ? `You are checked back in. Your break ended ${minutesLate} minute${minutesLate === 1 ? "" : "s"} late.`
          : "You are checked back in. Welcome back!"
      );

      return;
    }

    const now = new Date();
    const breakMinutes = Number(settings.breakMinutes ?? 30);
    const lateGrace = Number(settings.lateGrace ?? 5);
    const dueBack = new Date(
      now.getTime() + (breakMinutes + lateGrace) * 60 * 1000
    );

    const recordId = getId();
    const name = resolvedName || friendlyName(previousRecord, badge);

    await setDoc(dashboardBreakDocument(recordId), {
      badge,
      name: name.startsWith("Badge ") ? "Unknown" : name,
      startTime: now.toISOString(),
      dueBack: dueBack.toISOString(),
      returnTime: "",
      lateAlertSent: false,
      returnLateAlertSent: false,
      lateMinutes: 0,
      kioskScan: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    showSuccess(
      `Thank you, ${name}!`,
      `Your break has started. You may scan back in after ${new Date(now.getTime() + MINIMUM_BREAK_MS).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      })}.`
    );
  } catch (error) {
    console.error("Kiosk scan failed:", error);

    const code = String(error?.code || "");

    if (code.includes("permission-denied")) {
      showError("Dashboard access expired. Return to the dashboard and reopen the kiosk.");
    } else {
      showError(error?.message || "Please try scanning again.");
    }
  }
}

function handleBadgeInput() {
  if (isProcessing) return;

  const badge = el.badgeInput.value.trim();
  const scannedName = el.nameInput.value.trim();
  if (!badge) return;

  isProcessing = true;
  el.badgeInput.value = "";
  el.nameInput.value = "";
  processScan(badge, scannedName);
}

el.badgeInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleBadgeInput();
  }
});

document.addEventListener("click", event => {
  if (event.target !== el.returnButton) {
    focusScanner();
  }
});

el.returnButton.addEventListener("click", () => {
  window.location.href = "index.html";
});

el.dashboardName.textContent = dashboardName;
updateClock();
setInterval(updateClock, 1000);

onAuthStateChanged(auth, async user => {
  if (!user) {
    showError("Open the dashboard first, then click Open Kiosk.");
    return;
  }

  try {
    const tokenResult = await user.getIdTokenResult(true);
    const allowedDashboardId = tokenResult.claims.dashboardId;

    if (!dashboardId || !allowedDashboardId || dashboardId !== allowedDashboardId) {
      showError("Dashboard access could not be verified. Return to the dashboard and open the kiosk again.");
      return;
    }

    showScreen("home");
    focusScanner();
  } catch (error) {
    console.error("Could not verify kiosk access:", error);
    showError("Could not verify dashboard access. Return to the dashboard and try again.");
  }
});
