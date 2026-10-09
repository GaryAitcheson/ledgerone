# LedgerOne for iPad

An installable web app ("Add to Home Screen") that shows and edits the same book as LedgerOne for Windows,
in the same Moneydance style: Summary, sidebar with balances, two-line registers (default filter **This month**,
plus **Past 30 days + future**), reminders, budget and categories, light/dark mode. It works offline and
needs no Mac or App Store.

**What you can do on the iPad:** view everything; add, edit and delete transactions (including splits and
transfers); tap the status mark to clear/reconcile; record or skip reminders. Set up accounts, categories,
reminders and budgets in LedgerOne on Windows.

## How sync works

```
LedgerOne (Windows) ──▶ Dropbox\Apps\<your app>\ledger.json ◀── LedgerOne for iPad (Dropbox API)
```

* LedgerOne on Windows keeps its book in your Dropbox app folder. The Dropbox desktop app syncs the file;  LedgerOne watches it and reloads within seconds when the iPad changes it.
* The iPad keeps a full copy offline and syncs when opened, after edits (8 s later) and when back online.
* Both apps **merge** rather than overwrite: changes are matched record by record (transactions, accounts,
  reminders, budget lines), so edits made on both devices are kept. If the same transaction was edited on
  both before syncing, the device doing the sync keeps its own version and says so.
* Your data goes only to your own Dropbox. The app's access is limited to its own app folder.
* Each sync transfers the whole book (about 12–17 MB), so the first sync on mobile data takes a moment.

## One-time setup (about 10 minutes)

### 1. Put the app online (HTTPS is required to install it)

The app is just the files in this `web` folder (no data in it). Any static HTTPS host works, for example
**GitHub Pages** (free):

1. In GitHub Desktop: *File ▸ New repository*, name it `ledgerone`, then copy the contents of this `web`
   folder into the new repository folder.
2. Commit and *Publish repository*. Untick "Keep this code private" — free GitHub Pages needs a public
   repository. The code contains no personal data; your book never goes to GitHub.
3. On github.com ▸ the repository ▸ *Settings ▸ Pages* ▸ Source: *Deploy from a branch*, branch `main`, folder `/ (root)`.
4. After a minute the app is at `https://<your-github-name>.github.io/ledgerone/`.

(Alternatives: Cloudflare Pages or Netlify — drag the `web` folder onto their "deploy" page.)

### 2. Create your Dropbox app (gives the iPad app its own folder)

1. Go to <https://www.dropbox.com/developers/apps> ▸ **Create app**.
2. Choose **Scoped access** ▸ **App folder** ▸ name it, e.g. `LedgerOne-Gary` (names must be unique).
3. On the **Permissions** tab tick `files.metadata.read`, `files.content.read`, `files.content.write` ▸ **Submit**.
4. On the **Settings** tab copy the **App key** (not the secret — the app doesn't need it).

### 3. Install on the iPad and connect

1. Open your app address in **Safari** ▸ Share ▸ **Add to Home Screen**.
2. Open **LedgerOne from the Home Screen** (connect from there — Home Screen apps have their own storage).
3. *Settings* ▸ paste the App key ▸ **Open Dropbox** ▸ **Allow** ▸ copy the code ▸ back in LedgerOne paste it ▸ **Connect**.
   This creates the folder `Dropbox\Apps\LedgerOne-Gary` (it shows "No ledger.json in Dropbox yet" until step 4).

### 4. Point LedgerOne on Windows at that folder

1. Wait for `C:\Users\Gary Aitcheson\Dropbox\Apps\LedgerOne-Gary` to appear on the PC.
2. LedgerOne ▸ **Settings ▸ Sync with iPad ▸ Move data to a folder…** ▸ choose that folder.
3. On the iPad tap the sync status (top bar) — your book downloads and you're done.

Daily backups stay on the PC in `LedgerOne\Data\backups`. To stop syncing use *Move back to this PC*.

## Without Dropbox (manual, e.g. iCloud Drive)

iPad *Settings ▸ Files*: **Open a file…** reads a `ledger.json` (for example one you saved to iCloud Drive
from the PC with *Settings ▸ Save a copy…*), merging it with the iPad's book. **Save a copy…** sends the
iPad's book back through the share sheet (*Save to Files*); open it on the PC with *Settings ▸ Open…*.

## Files

| File | Purpose |
|---|---|
| `index.html`, `app.css` | Shell and Moneydance-style theme (light/dark) |
| `js/app.js` | Screens: summary, sidebar, register, editor, reminders, budget, categories, settings |
| `js/ledger.js` | Balances, register order, reminders — ported from `Services/Ledger.cs` |
| `js/merge.js` | Three-way merge (same rules as `Services/LedgerMerge.cs`) |
| `js/sync.js` | Dropbox sign-in (PKCE, pasted code) and sync |
| `js/store.js` | Offline storage (IndexedDB) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline cache and Home Screen install |

When you change the app, bump `VERSION` in `sw.js` so installed copies pick up the update.
