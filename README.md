# Can I? — prototype v2.4

The exact HTML, CSS and JavaScript of the current Can I? prototype, ready for your own GitHub repository. No build step, API key or runtime package installation is required.

## Put it on GitHub

1. Unzip this download.
2. Create a GitHub repository, such as `can-i`.
3. Upload the contents of the `can-i` folder into the repository root. Do not upload the ZIP itself.
4. Include the hidden `.github` folder if you want GitHub Pages. A git push is the easiest way to preserve hidden folders.

The root should contain `dist/`, `tests/`, `README.md`, `netlify.toml` and `vercel.json`.

## Publish with Netlify

1. At https://app.netlify.com choose **Add new project → Import an existing project**.
2. Connect GitHub and choose your repository.
3. Keep the base directory at the repository root. Leave the build command empty. Set the publish directory to **dist** (the included netlify.toml also sets it).
4. Publish. Check your project's visitor access settings and make it public if you want students outside your team to use it.
5. Open the production URL in a private browser window to verify access, then share that URL.

Future pushes to the connected branch trigger new deployments.

## Publish with Vercel instead

1. At https://vercel.com import your GitHub repository.
2. Keep the root directory at the repository root and choose framework preset **Other**.
3. Set output directory to **dist**. Enable the build command override and leave it empty. The included vercel.json specifies these settings too.
4. Deploy and share the production URL. Check deployment protection settings if testers see a sign-in page.

## Publish with GitHub Pages instead

The included workflow publishes only `dist/`, with no build step.

1. Include `.github/workflows/pages.yml` in the repository.
2. In GitHub, open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.
3. Push to `main`, or run **Deploy GitHub Pages** manually from the Actions tab.
4. Find your live URL under Settings → Pages.

The workflow assumes your default branch is `main`; edit it if your branch has a different name. GitHub Pages on GitHub Free requires a public repository.

## Run locally

From the repository root, using Python 3:

```sh
python -m http.server 8000 --directory dist
```

Open http://localhost:8000. Use an HTTP server: opening index.html directly from disk will not reliably load JavaScript modules.

## Run calculation tests

With Node.js installed:

```sh
node --test tests/engine.test.mjs tests/multi.test.mjs
```

## Source map

- `dist/index.html`: page structure.
- `dist/styles.css`: appearance and responsive layout.
- `dist/app.mjs`: interaction, rendering and browser storage.
- `dist/engine.mjs`: money calculations and single-action scenarios.
- `dist/multi.mjs`: multi-item plans and comparisons.
- `tests/`: calculation checks.

## What this version does

Enter cash, essentials, protected savings, income and debts. Compare up to three distinct ways to allocate the same budget across multiple items. Simulate multiple What if actions together. Savings use requires an explicit choice. Upcoming debt payments are shown separately; primary scenario balances reflect selected actions and essentials. The optional full commitment forecast shows what happens if all outstanding payments are also made.

Previews do not change balances. Recording actions is explicit and supports undo. An expense marked as already included in essentials reduces the remaining essentials amount so it is not counted twice.

## Prototype scope

This app runs in the browser, with deterministic calculations and explanations. It does not yet call an AI model, connect banks, execute payments or provide user accounts. Starting values are fictional demo data. Currency is USD.

Data and activity are saved in that browser's localStorage, not a shared database. A new device, browser or hosting domain starts with its own data. Browser storage is not encrypted. The “Private prototype” text in the UI is a label, not an access control; visitor access is configured with your host.

Google Fonts supplies DM Sans and Manrope; system fonts are used if unavailable.

## Export verification

App source and tests were copied from commit `e64a0f2a51bbbf4646a99723284b36ccd9b6d834` without modifying their contents. Hosting configurations and this guide were added for the export. Calculation tests pass; an external deployment and browser acceptance check remain to be performed on your hosting account.

## Official hosting guides

- https://docs.netlify.com/start/quickstarts/deploy-from-repository/
- https://vercel.com/docs/builds/configure-a-build
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
