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

## Slack return-late alerts

This version sends Slack alerts when an AA returns from break late, not when they first become late. That lets the alert include the final late time.

Example Slack message:

```text
🚨 Late From Break Return
Name: Test Late One
Badge: E015GUGD2V6
Due Back: 7:25 PM
Returned: 7:41 PM
Minutes Late: 16
```

Returned AAs who were late stay counted in the red Late total. Their returned time also shows red on the board.

Slack Workflow Builder should use one webhook variable:

```text
Key: message
Data type: Text
```
