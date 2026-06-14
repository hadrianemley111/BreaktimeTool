# Break Time Tracker

A browser-based break time tracker for badge scanning with optional Slack Workflow Builder late alerts.

## GitHub Pages setup

Upload these files to the root of your GitHub repo:

```text
index.html
css/styles.css
js/app.js
README.md
```

Then enable GitHub Pages from **Settings → Pages → Deploy from branch → main → /root**.

## Slack setup

This version is made for a Slack Workflow Builder webhook with one data variable:

```text
Key: message
Data type: Text
```

The app sends this JSON body:

```json
{
  "message": "Slack connected"
}
```

In the Slack workflow **Send a message to a channel** step, insert the webhook variable named `message` from the variable picker.

Do not add separate webhook variables like `Name`, `badge`, `text`, or `dueBack`.

## Notes

- The Slack webhook URL is saved only in the browser local storage.
- Do not commit your Slack webhook URL to GitHub.
- Use browser DevTools Console to inspect the exact Slack payload being sent.
