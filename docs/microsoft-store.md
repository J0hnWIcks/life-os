# Publishing Life OS to the Microsoft Store

Both registering as a developer and publishing are free — Microsoft removed
the individual developer fee in 2025. This doc walks through the whole path,
start to finish.

## 1. Create a free Partner Center account

1. Go to https://partner.microsoft.com/dashboard/registration and choose
   **Individual developer (free)**.
2. Sign in with a Microsoft account (create one if you don't have one).
3. Complete identity verification — this now requires a government-issued ID
   photo + a selfie instead of a credit card. No payment is requested at any
   point in this flow.

## 2. Reserve the app name and get your identity values

1. In Partner Center, go to **Apps and games** → **New product** → **App**.
2. Reserve the name `Life OS` (or whatever you want it listed as — if taken,
   add a qualifier like `Life OS - Personal Organizer`).
3. Once reserved, open the product page and find **Product identity** under
   the app's settings. You'll see three values:
   - **Package/Identity/Name** → this is `identityName`
   - **Package/Identity/Publisher** → this is `publisher` (looks like
     `CN=12345678-1234-1234-1234-123456789012`)
   - **Publisher display name** → this is `publisherDisplayName`
4. Open `package.json` in the project root and replace the two placeholder
   values in the `"appx"` block:
   ```json
   "identityName": "REPLACE_WITH_PACKAGE_IDENTITY_NAME",
   "publisher": "REPLACE_WITH_PUBLISHER_ID",
   ```
   with the exact values from Partner Center. `publisherDisplayName` is
   already set — update it only if Partner Center shows something different
   from what's already there.

## 3. Build the package (must be done on Windows)

The `.appx` builder relies on Windows-only signing tools, so this step can't
be done on Mac/Linux — run it from Git Bash (or PowerShell) on your Windows
machine, from inside the `life-os` folder:

```bash
npm run install:all
npm run dist:win
```

This produces both a regular installer (`.exe`, for direct/GitHub-release
downloads) and a Store package (`.appx`) in the `release/` folder, since the
`win.target` list now includes both `nsis` and `appx`.

If you only want the Store package, you can run electron-builder directly
with just that target:

```bash
npx electron-builder --win appx
```

## 4. Submit for certification

1. Back in Partner Center, on your app's product page, go to **Packages**
   and upload the `.appx` file from `release/`.
2. Fill out **Store listing**: description, at least one screenshot (you can
   just screenshot the running app), and category (Productivity fits well).
3. Fill out **Age ratings** — a short questionnaire; Life OS should land in
   the lowest tier since it has no objectionable content.
4. **Privacy policy URL** — the Store requires one even for an app that
   collects nothing. This is already written for you at `docs/privacy.html`
   in this repo. To make it live:
   - Push this repo to GitHub (if you haven't already)
   - Go to **Settings → Pages** on the repo, and under "Build and
     deployment" set **Source** to "Deploy from a branch," branch `main`,
     folder `/docs`
   - Save — GitHub will give you a URL like
     `https://J0hnWIcks.github.io/life-os/privacy.html`
   - Paste that URL into the Store listing's privacy policy field
5. Click **Submit for certification**. Review is automated plus a light
   manual check — typically same-day to a few days for a straightforward
   app like this.

## Notes

- You can keep publishing regular `.exe` releases on GitHub *and* have the
  Store listing at the same time — they're not exclusive.
- Once live, updating the Store version means bumping `"version"` in
  `package.json`, rebuilding, and uploading a new `.appx` package through
  the same Partner Center product page.
