# Flappy Bird Project

This workspace now includes two versions of the game:

- a `pygame` desktop version in `main.py`
- a web version in `index.html`

## Web Version

Open `index.html` directly, or serve the folder locally.

If you prefer serving the folder instead of opening the file directly, you can run:

```bash
python -m http.server
```

Then open `http://localhost:8000`.

You can also run it as a simple Node web app:

```bash
npm install
npm start
```

Then open `http://127.0.0.1:3000`.

For install prompts on mobile, use `http://localhost` during testing or deploy to an `https://` URL.

### Web Features

- local login and registration
- persistent high scores saved in `localStorage`
- a local leaderboard
- keyboard, mouse, and touch controls

## GitHub Pages

This repo now includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml`
that deploys the web version to GitHub Pages whenever `main` is updated.

To turn it on in GitHub:

1. Open the repository `Settings`
2. Go to `Pages`
3. Under `Build and deployment`, set `Source` to `GitHub Actions`

After the first successful workflow run, the site should be available at:

`https://renz113.github.io/BIRDDDDDDDDD/`

## Pygame Version

Run:

```bash
python main.py
```

## Notes

- The web version stores users and scores only on the same device profile
- The `pygame` version stores users in `data/users.json`
