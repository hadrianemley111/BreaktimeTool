# Break Time Tracker

Browser-based break time tracker for badge scanning with optional Slack late alerts.

## How to run

Open `index.html` directly, or publish the repo with GitHub Pages.

## Slack setup

1. Open the tracker.
2. Click **Settings**.
3. Check **Send Slack alert when a person becomes late**.
4. Paste your Slack webhook URL.
5. Click **Save Settings**.
6. Reopen **Settings** and click **Test Slack**.

The Slack test sends exactly:

```text
Slack connected
```

For Slack Workflow Builder webhooks, make the workflow message post the `message` variable.
For normal Slack Incoming Webhooks, Slack uses the `text` field.

The webhook URL is saved only in your browser local storage. Do not commit webhook URLs to GitHub.

## Data

Use **Download** to export the tracker data as JSON.
Use **Upload** to import a saved JSON backup.
