# Break Time Tracker

A browser-based break time tracker for badge scanning with optional Slack late alerts.

## Features

- Crisp SVG Amazon-style header mark that does not get blurry on GitHub Pages

- Badge scan input optimized for scanner + Enter key
- Same badge scanned twice marks the person returned
- Configurable break duration and grace period
- Live status board for:
  - On Break
  - Late
  - Returned
  - Total Scans
- Optional Slack Incoming Webhook alerts when someone becomes late
- Manual **Send Late List to Slack** button
- Local browser storage
- JSON upload/download for moving data between computers
- Works on GitHub Pages

## Important Slack Note

Do **not** put your Slack webhook URL directly in the code or commit it to GitHub.

This app stores the webhook URL only in the browser using `localStorage`. Add it from **Settings** after opening the site.

Slack incoming webhooks are designed to receive a JSON payload over HTTP. The browser version uses a direct frontend request, which is acceptable for a simple static page, but a backend/proxy is better for production because it protects the webhook URL and avoids browser/CORS issues.

## How to Set Up Slack Alerts

1. In Slack, create or choose an app with **Incoming Webhooks** enabled.
2. Copy the webhook URL for the channel you want alerts posted to.
3. Open the Break Time Tracker.
4. Click **Settings**.
5. Check **Send Slack alert when a person becomes late**.
6. Paste the webhook URL.
7. Click **Save Settings**.
8. Use **Test Slack** to send a test message.

When someone becomes late, the app sends one alert for that person. It will not keep spamming every refresh.

## Project Structure

```text
break-time-tracker/
├── index.html
├── css/
│   └── styles.css
├── js/
│   └── app.js
├── README.md
└── .gitignore
```

## How to Run Locally

Open `index.html` in a browser.

No build step is required.

## GitHub Pages

This project can run on GitHub Pages because it is static HTML, CSS, and JavaScript.

1. Create a GitHub repository.
2. Upload these files.
3. Make sure `index.html` is in the root of the repo.
4. Go to **Settings → Pages**.
5. Choose the main branch and root folder.
6. Open the GitHub Pages link.

## Data Storage

The app saves data in the browser using `localStorage`.

That means:

- Data stays on the computer/browser where it was entered.
- Clearing browser storage will erase the saved tracker data.
- Use **Download** to back up the data.
- Use **Upload** to move the data to another computer.

## Suggested Repository Name

```text
break-time-tracker
```

## Future Improvements

- Employee name lookup from approved internal source
- Shared database instead of local browser storage
- Backend Slack proxy for more secure Slack alerts
- Audit log
- Admin-only settings


## Latest fixes

- Fixed backup download by creating and clicking a temporary download link reliably.
- Fixed upload by resetting the file input before each upload and accepting both old array-only backups and newer full backup files.
- Slack test now posts `Slack connected` to the configured Slack channel.
