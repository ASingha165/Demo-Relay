# Demo Relay

Prepare a hackathon demo and share a read-only snapshot with your team. Record the presenter, backup owner, demo and repository URLs, fallback plan, and run order. Track readiness and copy the handoff as plain text.

## Run locally

Install Node.js 24.11 or later, open this folder in VS Code, and run:

```sh
npm start
```

Open http://127.0.0.1:3000 and choose **Load example** to try it. There are no package dependencies.

## How sharing works

Drafts are saved in the current browser. **Create share link** saves an immutable snapshot in SQLite and returns a link with a random ID. Anyone who can access the server and has the link can read the snapshot. Treat its contents as shareable and avoid entering secrets. Changes to a draft require a new link.

For remote use, run on a Node.js host with HTTPS and a persistent disk. Set **HOST** to **0.0.0.0**, use the host-provided **PORT**, and point **DATA_DIR** at the persistent volume. Restrict server access at the hosting layer if you only want teammates to create and view snapshots. The application has no accounts or snapshot deletion UI.

## API

| Method | Path | Description |
| --- | --- | --- |
| POST | /api/handoffs | Create a validated snapshot from the seven text fields and four checklist values |
| GET | /api/handoffs/:id | Retrieve a snapshot |
