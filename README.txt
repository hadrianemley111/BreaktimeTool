BREAK TOOL KIOSK INSTALLATION

FILES TO ADD
------------
1. Put kiosk.html beside index.html.
2. Put kiosk.css beside index.html.
3. Put kiosk.js beside app.js.

DASHBOARD CHANGES
-----------------
Open dashboard-kiosk-patch.js and follow its four marked steps:

1. Add the Open Kiosk button to index.html.
2. Add openKioskButton to the existing el object in app.js.
3. Add the openKiosk() function to app.js.
4. Add the event listener inside bindEvents().

HOW IT WORKS
------------
- The button opens a kiosk for the dashboard currently signed in.
- The kiosk uses the same Firebase dashboard collection.
- A first scan starts the break.
- A second scan ends the break.
- A person cannot scan back in until five minutes after the break started.
- The kiosk shows "Please wait" while Firebase is checked.
- It then shows the employee name when the name has been saved before.
- There is no manager code.
- "Return to Dashboard" closes the kiosk tab and returns to the original dashboard.

IMPORTANT NAME NOTE
-------------------
The kiosk can show a name when that badge already has a named record in the
dashboard. A brand-new badge will display "Badge 123..." until your existing
PPA helper or dashboard saves that employee's name.
