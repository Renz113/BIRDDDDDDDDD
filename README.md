# Flappy Bird Project

This workspace now includes two versions of the game:

- a `pygame` desktop version in `main.py`
- a web version in `index.html`

## Web Version

Open `index.html` in your browser.

If you prefer serving the folder instead of opening the file directly, you can run:

```bash
python -m http.server
```

Then open `http://localhost:8000`.

### Web Features

- local login and registration
- persistent high scores saved in browser `localStorage`
- a local leaderboard
- keyboard, mouse, and touch controls

## Pygame Version

Run:

```bash
python main.py
```

## Notes

- The browser version stores users and scores only on the same browser profile
- The `pygame` version stores users in `data/users.json`
