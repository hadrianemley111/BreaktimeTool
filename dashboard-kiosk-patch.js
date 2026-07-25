/*
  DASHBOARD KIOSK PATCH
  Add the HTML button to index.html, then make the app.js changes below.
*/

/* =========================================================
   1. ADD THIS BUTTON INSIDE .header-right OR .dashboard-session
   ========================================================= */

/*
<button id="openKioskButton"
        class="btn btn-green btn-small"
        type="button">
  Open Kiosk
</button>
*/


/* =========================================================
   2. ADD THIS PROPERTY INSIDE THE EXISTING const el = { ... }
   ========================================================= */

openKioskButton: document.getElementById("openKioskButton"),


/* =========================================================
   3. ADD THIS FUNCTION ANYWHERE ABOVE bindEvents()
   ========================================================= */

function openKiosk() {
  if (!activeDashboard) {
    alert("Open a dashboard first.");
    return;
  }

  const kioskUrl = new URL("kiosk.html", window.location.href);

  kioskUrl.searchParams.set("dashboard", activeDashboard.id);
  kioskUrl.searchParams.set("name", activeDashboard.name);

  const kioskWindow = window.open(
    kioskUrl.toString(),
    "_blank",
    "noopener=false"
  );

  if (!kioskWindow) {
    alert("The browser blocked the kiosk window. Allow pop-ups for this site.");
  }
}


/* =========================================================
   4. ADD THIS LINE INSIDE bindEvents()
   ========================================================= */

el.openKioskButton.addEventListener("click", openKiosk);
