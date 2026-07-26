GITHUB WEBSITE FILES

Upload everything in this folder to the root of your GitHub repository.

Important files:
- index.html
- css/styles.css
- js/app.js
- kiosk.html
- kiosk.css
- kiosk.js
- ppa-helper.user.js

Slack:
- There is no Slack URL box in Settings.
- The checkbox enables or disables Slack for the dashboard.
- The website and kiosk call the deployed Firebase callable function:
  sendBreakSlack
- No alert is sent merely because someone becomes late.
- A late-return alert is sent only after the employee scans back in.
- The Test Slack button sends a detailed test message.

After uploading:
1. Commit the files.
2. Wait for GitHub Pages to update.
3. Refresh with Ctrl + Shift + R.
4. Open Settings, check Slack, save, then click Test Slack.
