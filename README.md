# Break Time Tracker

A simple browser-based break time tracker for badge scanning.

## Features

- Badge scan input optimized for scanner + Enter key
- Same badge scanned twice marks the person returned
- Configurable break duration and grace period
- Live status board for:
  - On Break
  - Late
  - Returned
  - Total Scans
- Local browser storage
- JSON upload/download for moving data between computers
- Access notice with a link to the Break Time KCVG permissions team

## Important Security Note

This static GitHub version **does not securely verify Amazon Permissions team membership**.

A browser-only app cannot reliably check whether a user belongs to an Amazon Permissions team. For real access control, host this behind an internal authenticated backend or an approved internal Amazon hosting layer.

Recommended production flow:

```text
User opens tracker
        ↓
Internal auth verifies user
        ↓
Backend gets logged-in alias
        ↓
Backend checks Break Time KCVG team membership
        ↓
Allowed users get the app
Denied users get blocked
```

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
3. Go to **Settings → Pages**.
4. Choose the main branch and root folder.
5. Open the GitHub Pages link.

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

- Backend authentication
- Real permissions-team verification
- Employee name lookup from approved internal source
- Shared database instead of local browser storage
- Audit log
- Admin-only settings
