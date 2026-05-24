const STORAGE_KEY = "flappyBirdWebUsersV1";
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ui = {
  authCard: document.getElementById("authCard"),
  playerCard: document.getElementById("playerCard"),
  authForm: document.getElementById("authForm"),
  loginTab: document.getElementById("loginTab"),
  registerTab: document.getElementById("registerTab"),
  usernameInput: document.getElementById("usernameInput"),
  passwordInput: document.getElementById("passwordInput"),
  authSubmit: document.getElementById("authSubmit"),
  leaderboardList: document.getElementById("leaderboardList"),
  leaderboardCard: document.getElementById("leaderboardCard"),
  welcomeHeading: document.getElementById("welcomeHeading"),
  playerSummary: document.getElementById("playerSummary"),
  profileBest: document.getElementById("profileBest"),
  profileLast: document.getElementById("profileLast"),
  scoreValue: document.getElementById("scoreValue"),
  bestValue: document.getElementById("bestValue"),
  bestBadge: document.getElementById("bestBadge"),
  userBadge: document.getElementById("userBadge"),
  modeBadge: document.getElementById("modeBadge"),
  messageBanner: document.getElementById("messageBanner"),
  heroInstallPanel: document.getElementById("heroInstallPanel"),
  heroInstallButton: document.getElementById("heroInstallButton"),
  heroInstallNote: document.getElementById("heroInstallNote"),
  startButton: document.getElementById("startButton"),
  logoutButton: document.getElementById("logoutButton"),
  exitViewButton: document.getElementById("exitViewButton"),
  gameColumn: document.getElementById("gameColumn"),
  gameFrame: document.getElementById("gameFrame"),
  installButton: document.getElementById("installButton"),
  installHint: document.getElementById("installHint"),
  installBanner: document.getElementById("installBanner"),
  installBannerHost: document.getElementById("installBannerHost"),
  installBannerButton: document.getElementById("installBannerButton"),
  installBannerClose: document.getElementById("installBannerClose"),
  installGate: document.getElementById("installGate"),
  installGateText: document.getElementById("installGateText"),
  installGateButton: document.getElementById("installGateButton"),
  continueWebButton: document.getElementById("continueWebButton"),
};

const state = {
  authMode: "login",
  currentUserKey: null,
  mode: "auth",
  message: "Create an account or log in to play.",
  tone: "info",
};

const storageState = {
  supported: canUseLocalStorage(),
  memoryUsers: {},
};

const installState = {
  deferredPrompt: null,
  dismissed: false,
};

const viewState = {
  immersive: false,
};

const launchState = {
  handled: false,
};

const GAME = {
  width: 480,
  height: 720,
  groundHeight: 110,
  birdStartX: 132,
  birdStartY: 310,
  birdRadius: 18,
  gravity: 0.42,
  flapVelocity: -8.2,
  pipeWidth: 84,
  pipeGap: 178,
  pipeSpeed: 3.3,
  pipeSpawnMs: 1450,
};

const game = {
  bird: createBird(),
  pipes: [],
  score: 0,
  floorOffset: 0,
  cloudOffset: 0,
  idleTime: 0,
  spawnElapsed: 0,
  lastFrameTime: 0,
};

function canUseLocalStorage() {
  try {
    const testKey = "__flappy_test__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    return true;
  } catch (error) {
    return false;
  }
}

function createBird() {
  return {
    x: GAME.birdStartX,
    y: GAME.birdStartY,
    radius: GAME.birdRadius,
    velocity: 0,
    tilt: 0,
  };
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function wrap(value, span) {
  return ((value % span) + span) % span;
}

function userKey(username) {
  return username.trim().toLowerCase();
}

function hashPassword(password) {
  let hash = 5381;
  for (let index = 0; index < password.length; index += 1) {
    hash = ((hash << 5) + hash) ^ password.charCodeAt(index);
  }
  return `h${(hash >>> 0).toString(16)}`;
}

function loadUsers() {
  if (!storageState.supported) {
    return storageState.memoryUsers;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

function saveUsers(users) {
  if (!storageState.supported) {
    storageState.memoryUsers = users;
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

function getCurrentUser() {
  if (!state.currentUserKey) {
    return null;
  }
  return loadUsers()[state.currentUserKey] || null;
}

function registerUser(username, password) {
  const trimmed = username.trim();
  if (!USERNAME_PATTERN.test(trimmed)) {
    return { ok: false, message: "Username must be 3 to 16 characters using letters, numbers, or _." };
  }
  if (password.length < 4) {
    return { ok: false, message: "Password must be at least 4 characters." };
  }

  const users = loadUsers();
  const key = userKey(trimmed);

  if (users[key]) {
    return { ok: false, message: "That username already exists." };
  }

  users[key] = {
    displayName: trimmed,
    passwordHash: hashPassword(password),
    bestScore: 0,
    lastScore: 0,
  };
  saveUsers(users);

  return { ok: true, key, message: "Account created. You can start playing." };
}

function authenticateUser(username, password) {
  const key = userKey(username);
  const user = loadUsers()[key];

  if (!user) {
    return { ok: false, message: "User not found. Register first or try again." };
  }
  if (user.passwordHash !== hashPassword(password)) {
    return { ok: false, message: "Incorrect password." };
  }

  return { ok: true, key, message: "Login successful. Time to fly." };
}

function updateUserScore(score) {
  if (!state.currentUserKey) {
    return null;
  }

  const users = loadUsers();
  const user = users[state.currentUserKey];

  if (!user) {
    return null;
  }

  user.lastScore = Math.max(0, score);
  user.bestScore = Math.max(Number(user.bestScore || 0), user.lastScore);
  saveUsers(users);
  return user;
}

function getLeaderboard(limit = 5) {
  return Object.values(loadUsers())
    .sort((left, right) => {
      const scoreDiff = Number(right.bestScore || 0) - Number(left.bestScore || 0);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return String(left.displayName).localeCompare(String(right.displayName));
    })
    .slice(0, limit);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function canSuggestIosInstall() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(userAgent);
  const isSafari = /safari/.test(userAgent) && !/crios|fxios|edgios|opios/.test(userAgent);
  return isIos && isSafari;
}

function isLikelyMobileDevice() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /android|iphone|ipad|ipod/.test(userAgent) || window.matchMedia("(max-width: 820px)").matches;
}

function shouldShowInstallGate() {
  return !isStandaloneMode() && !installState.dismissed && isLikelyMobileDevice();
}

function shouldUseImmersivePlayView() {
  return isLikelyMobileDevice() && !shouldShowInstallGate();
}

function currentInstallActionLabel() {
  if (isStandaloneMode()) {
    return "Installed";
  }

  if (installState.deferredPrompt) {
    return "Install";
  }

  if (canSuggestIosInstall()) {
    return "Add To Home";
  }

  return "Install Info";
}

function shouldShowInstallBanner() {
  return !isStandaloneMode()
    && !installState.dismissed
    && isLikelyMobileDevice()
    && (Boolean(installState.deferredPrompt) || canSuggestIosInstall());
}

function syncViewState() {
  document.body.dataset.mobilePlay = viewState.immersive ? "immersive" : "page";
}

function setImmersiveView(active) {
  viewState.immersive = active;
  syncViewState();
}

async function requestFullscreenView() {
  if (document.fullscreenElement || typeof ui.gameColumn.requestFullscreen !== "function") {
    return;
  }

  try {
    await ui.gameColumn.requestFullscreen({ navigationUI: "hide" });
  } catch (error) {
    // Some mobile browsers block fullscreen for arbitrary elements, so we keep the CSS immersive view.
  }
}

function enterMobilePlayView() {
  if (!shouldUseImmersivePlayView()) {
    return;
  }

  setImmersiveView(true);
  requestFullscreenView();
}

function exitMobilePlayView() {
  setImmersiveView(false);
  if (document.fullscreenElement && typeof document.exitFullscreen === "function") {
    document.exitFullscreen().catch(() => {
      syncViewState();
    });
  }
}

function focusGameArea() {
  const top = ui.gameColumn.getBoundingClientRect().top;
  const shouldScroll = window.innerWidth <= 960 || top < 0 || top > 80;

  if (shouldScroll) {
    ui.gameColumn.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  }

  canvas.focus({ preventScroll: true });
}

function scrollElementIntoView(element) {
  if (!element) {
    return;
  }

  element.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
}

function clearLaunchParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("launch")) {
    return;
  }

  url.searchParams.delete("launch");
  const nextSearch = url.searchParams.toString();
  const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`;
  window.history.replaceState({}, "", nextUrl);
}

function renderInstallBanner() {
  const visible = shouldShowInstallBanner();
  ui.installBanner.classList.toggle("is-hidden", !visible);

  if (!visible) {
    return;
  }

  ui.installBannerHost.textContent = window.location.host || "Open from localhost or HTTPS";
  ui.installBannerButton.textContent = currentInstallActionLabel();
  ui.installBannerButton.disabled = isStandaloneMode();
}

function renderHeroInstall(label, note, visible = true, disabled = false) {
  ui.heroInstallPanel.classList.toggle("is-hidden", !visible);
  ui.heroInstallButton.textContent = label;
  ui.heroInstallButton.disabled = disabled;
  ui.heroInstallNote.textContent = note;
}

function renderInstallCta() {
  if (isStandaloneMode()) {
    renderHeroInstall("Installed", "This page is already running in app mode from your home screen.", false, true);
    ui.installButton.classList.add("is-hidden");
    ui.installButton.disabled = true;
    ui.installHint.textContent = "Installed app mode is ready for quick mobile play.";
    ui.installGateButton.textContent = "Installed";
    ui.installGateText.textContent = "Flappy Bird Club is already running like an installed app.";
    return;
  }

  if (installState.deferredPrompt) {
    renderHeroInstall("Install", "Tap Install on the home page to open the real native app install popup.", true, false);
    ui.installButton.classList.remove("is-hidden");
    ui.installButton.disabled = false;
    ui.installButton.textContent = "Install";
    ui.installHint.textContent = "Install this app for one-tap access from your home screen.";
    ui.installGateButton.textContent = "Install";
    ui.installGateText.textContent = "Install Flappy Bird Club first for the cleanest mobile app experience.";
    return;
  }

  if (canSuggestIosInstall()) {
    renderHeroInstall("Add To Home", "From this home page, tap Share and then Add to Home Screen in Safari.", true, false);
    ui.installButton.classList.remove("is-hidden");
    ui.installButton.disabled = false;
    ui.installButton.textContent = "Add To Home";
    ui.installHint.textContent = "On iPhone or iPad, tap Share and then Add to Home Screen.";
    ui.installGateButton.textContent = "How To Install";
    ui.installGateText.textContent = "For iPhone or iPad, use Share and then Add to Home Screen before playing.";
    return;
  }

  if (isLikelyMobileDevice()) {
    renderHeroInstall("Install Info", "Stay on the home page for a moment, then tap Install when the browser is ready.", true, false);
    ui.installButton.classList.remove("is-hidden");
    ui.installButton.disabled = false;
    ui.installButton.textContent = "Install Info";
    ui.installHint.textContent = "The real install prompt appears after the browser confirms the app is installable.";
    ui.installGateButton.textContent = "Install Info";
    ui.installGateText.textContent = "The browser has not exposed the install prompt yet. Open the live HTTPS site and wait a moment if needed.";
    return;
  }

  renderHeroInstall("Install", "Use Chrome or Edge here on the home page. When the browser allows install, this button opens it.", true, false);
  ui.installButton.classList.add("is-hidden");
  ui.installButton.disabled = true;
  ui.installHint.textContent = "Install is available from a secure mobile link when supported.";
  ui.installGateButton.textContent = "Install Info";
  ui.installGateText.textContent = "Use a supported mobile browser on the live HTTPS site to install this app.";
}

function renderInstallGate() {
  const visible = shouldShowInstallGate();
  ui.installGate.classList.toggle("is-hidden", !visible);
  document.body.dataset.installGate = visible ? "visible" : "hidden";

  if (visible && viewState.immersive) {
    exitMobilePlayView();
  }
}

function setMessage(message, tone = "info") {
  state.message = message;
  state.tone = tone;
  ui.messageBanner.textContent = message;
  ui.messageBanner.dataset.tone = tone;
}

function setMode(mode) {
  state.mode = mode;
  ui.modeBadge.textContent = formatMode(mode);
  document.body.dataset.mode = mode;
  renderControls();
}

function formatMode(mode) {
  if (mode === "auth") {
    return "Auth";
  }
  if (mode === "menu") {
    return "Menu";
  }
  if (mode === "playing") {
    return "Playing";
  }
  return "Game Over";
}

function renderAuthMode() {
  const isLogin = state.authMode === "login";
  ui.loginTab.classList.toggle("is-active", isLogin);
  ui.registerTab.classList.toggle("is-active", !isLogin);
  ui.authSubmit.textContent = isLogin ? "Log In" : "Create Account";
  ui.passwordInput.autocomplete = isLogin ? "current-password" : "new-password";
}

function renderPlayerCard() {
  const user = getCurrentUser();

  ui.authCard.classList.toggle("is-hidden", Boolean(user));
  ui.playerCard.classList.toggle("is-hidden", !user);
  ui.userBadge.textContent = user ? user.displayName : "Guest";

  if (!user) {
    ui.profileBest.textContent = "0";
    ui.profileLast.textContent = "0";
    ui.bestValue.textContent = "0";
    ui.bestBadge.textContent = "0";
    return;
  }

  ui.welcomeHeading.textContent = `Welcome, ${user.displayName}`;
  ui.playerSummary.textContent = storageState.supported
    ? "Your account and scores stay saved on this device."
    : "Local storage is unavailable, so scores last only for this tab.";
  ui.profileBest.textContent = String(user.bestScore || 0);
  ui.profileLast.textContent = String(user.lastScore || 0);
  ui.bestValue.textContent = String(user.bestScore || 0);
  ui.bestBadge.textContent = String(user.bestScore || 0);
}

function renderLeaderboard() {
  const rows = getLeaderboard();
  ui.leaderboardList.innerHTML = "";

  if (rows.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No scores yet. Be the first pilot.";
    ui.leaderboardList.appendChild(item);
    return;
  }

  rows.forEach((player, index) => {
    const item = document.createElement("li");

    const rank = document.createElement("span");
    rank.className = "leaderboard-rank";
    rank.textContent = String(index + 1);

    const name = document.createElement("span");
    name.className = "leaderboard-name";
    name.textContent = player.displayName;

    const score = document.createElement("span");
    score.className = "leaderboard-score";
    score.textContent = String(player.bestScore || 0);

    item.append(rank, name, score);
    ui.leaderboardList.appendChild(item);
  });
}

function renderControls() {
  const canPlay = Boolean(getCurrentUser());

  ui.startButton.disabled = !canPlay || state.mode === "playing";
  if (!canPlay) {
    ui.startButton.textContent = "Log In To Start";
  } else if (state.mode === "playing") {
    ui.startButton.textContent = "Flying...";
  } else if (state.mode === "gameover") {
    ui.startButton.textContent = "Play Again";
  } else {
    ui.startButton.textContent = "Start Game";
  }

  ui.logoutButton.disabled = !canPlay || state.mode === "playing";
  ui.exitViewButton.classList.toggle("is-hidden", !viewState.immersive);
  ui.scoreValue.textContent = String(game.score);
  renderInstallCta();
}

function renderAll() {
  syncViewState();
  document.body.dataset.mode = state.mode;
  renderAuthMode();
  renderPlayerCard();
  renderLeaderboard();
  renderControls();
  renderInstallBanner();
  renderInstallGate();
}

function switchAuthMode(mode) {
  state.authMode = mode;
  renderAuthMode();
  setMessage(mode === "login" ? "Log in with your local account." : "Create a new local player profile.");
}

function loginWithKey(key, message) {
  state.currentUserKey = key;
  ui.authForm.reset();
  ui.usernameInput.blur();
  ui.passwordInput.blur();
  setMode("menu");
  setMessage(message, "success");
  renderAll();
  requestAnimationFrame(focusGameArea);
}

function logout() {
  state.currentUserKey = null;
  ui.usernameInput.value = "";
  ui.passwordInput.value = "";
  resetGame(false);
  exitMobilePlayView();
  setMode("auth");
  setMessage("Logged out. Sign in with any local player.", "info");
  renderAll();
}

function submitAuth(event) {
  event.preventDefault();

  const username = ui.usernameInput.value;
  const password = ui.passwordInput.value;

  const result = state.authMode === "login"
    ? authenticateUser(username, password)
    : registerUser(username, password);

  if (!result.ok) {
    setMessage(result.message, "error");
    renderAll();
    return;
  }

  loginWithKey(result.key, result.message);
}

function resetGame(updateHud = true) {
  game.bird = createBird();
  game.pipes = [];
  game.score = 0;
  game.floorOffset = 0;
  game.spawnElapsed = 0;
  game.idleTime = 0;
  if (updateHud) {
    ui.scoreValue.textContent = "0";
  }
}

function startGame() {
  if (!getCurrentUser()) {
    setMode("auth");
    setMessage("Create an account or log in before starting.", "error");
    renderAll();
    return;
  }

  enterMobilePlayView();
  resetGame();
  setMode("playing");
  setMessage("Flap with Space, Enter, click, or tap.", "info");
  renderAll();
  requestAnimationFrame(focusGameArea);
}

async function handleInstallRequest() {
  if (installState.deferredPrompt) {
    installState.deferredPrompt.prompt();
    const choice = await installState.deferredPrompt.userChoice;
    installState.deferredPrompt = null;

    if (choice.outcome === "accepted") {
      installState.dismissed = true;
      renderAll();
      setMessage("Install started. Open it from your home screen for the full app feel.", "success");
    } else {
      renderAll();
      setMessage("Install was dismissed. You can still continue on the web.", "info");
    }
    return;
  }

  if (canSuggestIosInstall()) {
    setMessage("On iPhone or iPad, tap Share and choose Add to Home Screen.", "info");
    return;
  }

  if (!window.isSecureContext) {
    setMessage("Install works only from localhost or an HTTPS deployment such as GitHub Pages.", "error");
    return;
  }

  if (isLikelyMobileDevice()) {
    setMessage("The browser has not exposed the install prompt yet. Wait a moment on the live site, then tap Install again.", "info");
    return;
  }

  setMessage("Use a supported mobile browser on the live HTTPS site to install this app.", "info");
}

function continueOnWeb() {
  installState.dismissed = true;
  exitMobilePlayView();
  renderAll();
  setMessage("Continuing on the web version.", "info");
}

function dismissInstallNotice() {
  installState.dismissed = true;
  renderAll();
}

function handleLaunchShortcut() {
  if (launchState.handled) {
    return;
  }

  const launch = new URLSearchParams(window.location.search).get("launch");
  if (!launch) {
    return;
  }

  launchState.handled = true;

  if (launch === "play") {
    clearLaunchParam();
    if (getCurrentUser()) {
      startGame();
      return;
    }

    setMode("auth");
    setMessage("Sign in first, then you can jump straight into a run.", "info");
    renderAll();
    requestAnimationFrame(() => {
      scrollElementIntoView(ui.authCard);
      ui.usernameInput.focus({ preventScroll: true });
    });
    return;
  }

  if (launch === "leaderboard") {
    clearLaunchParam();
    setMessage("Checking the leaderboard.", "info");
    renderAll();
    requestAnimationFrame(() => {
      scrollElementIntoView(ui.leaderboardCard);
    });
    return;
  }

  if (launch === "account") {
    clearLaunchParam();
    setMode(getCurrentUser() ? "menu" : "auth");
    setMessage(getCurrentUser() ? "Account ready. Pick up where you left off." : "Sign in or register to keep your scores saved.", "info");
    renderAll();
    requestAnimationFrame(() => {
      scrollElementIntoView(getCurrentUser() ? ui.playerCard : ui.authCard);
      if (!getCurrentUser()) {
        ui.usernameInput.focus({ preventScroll: true });
      }
    });
  }
}

function leavePlayView() {
  exitMobilePlayView();
  renderAll();
  setMessage("Exited the full-screen play view.", "info");
}

function finishGame() {
  const updatedUser = updateUserScore(game.score);
  setMode("gameover");

  if (updatedUser) {
    const best = Number(updatedUser.bestScore || 0);
    setMessage(`Round over. Score: ${game.score}. Personal best: ${best}.`, "success");
  } else {
    setMessage(`Round over. Score: ${game.score}.`, "info");
  }

  renderAll();
}

function flap() {
  if (state.mode !== "playing") {
    return;
  }
  game.bird.velocity = GAME.flapVelocity;
}

function spawnPipe() {
  const minGapY = 180;
  const maxGapY = GAME.height - GAME.groundHeight - 180;
  const gapY = Math.floor(Math.random() * (maxGapY - minGapY + 1)) + minGapY;
  game.pipes.push({
    x: GAME.width + 10,
    gapY,
    passed: false,
  });
}

function circleHitsRect(circle, rect) {
  const nearestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(circle.y, rect.y, rect.y + rect.height);
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

function pipeRects(pipe) {
  const topHeight = pipe.gapY - GAME.pipeGap / 2;
  const bottomY = pipe.gapY + GAME.pipeGap / 2;
  return {
    top: {
      x: pipe.x,
      y: 0,
      width: GAME.pipeWidth,
      height: topHeight,
    },
    bottom: {
      x: pipe.x,
      y: bottomY,
      width: GAME.pipeWidth,
      height: GAME.height - GAME.groundHeight - bottomY,
    },
  };
}

function updateGame(deltaMs) {
  const frame = deltaMs / 16.67;
  game.cloudOffset = (game.cloudOffset + 0.6 * frame) % (GAME.width + 220);
  game.floorOffset = (game.floorOffset + (state.mode === "playing" ? GAME.pipeSpeed : 0.9) * frame) % 34;

  if (state.mode === "auth" || state.mode === "menu") {
    game.idleTime += deltaMs;
    game.bird.y = GAME.birdStartY + Math.sin(game.idleTime / 260) * 14;
    game.bird.tilt = Math.sin(game.idleTime / 250) * 7;
    return;
  }

  if (state.mode !== "playing") {
    return;
  }

  game.spawnElapsed += deltaMs;
  if (game.spawnElapsed >= GAME.pipeSpawnMs) {
    game.spawnElapsed = 0;
    spawnPipe();
  }

  game.bird.velocity = clamp(game.bird.velocity + GAME.gravity * frame, -20, 12);
  game.bird.y += game.bird.velocity * frame;
  game.bird.tilt = clamp(game.bird.velocity * 4, -26, 34);

  if (game.bird.y - game.bird.radius <= 0 || game.bird.y + game.bird.radius >= GAME.height - GAME.groundHeight) {
    finishGame();
    return;
  }

  for (const pipe of game.pipes) {
    pipe.x -= GAME.pipeSpeed * frame;
    const rects = pipeRects(pipe);

    if (circleHitsRect(game.bird, rects.top) || circleHitsRect(game.bird, rects.bottom)) {
      finishGame();
      return;
    }

    if (!pipe.passed && pipe.x + GAME.pipeWidth < game.bird.x) {
      pipe.passed = true;
      game.score += 1;
      ui.scoreValue.textContent = String(game.score);
    }
  }

  game.pipes = game.pipes.filter((pipe) => pipe.x + GAME.pipeWidth > -8);
}

function drawCloud(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.beginPath();
  ctx.ellipse(-18, 10, 24, 16, 0, 0, Math.PI * 2);
  ctx.ellipse(0, 2, 26, 18, 0, 0, Math.PI * 2);
  ctx.ellipse(24, 12, 24, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, GAME.height);
  sky.addColorStop(0, "#87d8ff");
  sky.addColorStop(0.58, "#cceeff");
  sky.addColorStop(1, "#fff6dc");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, GAME.width, GAME.height);

  const sunGlow = ctx.createRadialGradient(380, 110, 10, 380, 110, 110);
  sunGlow.addColorStop(0, "rgba(255, 228, 138, 0.9)");
  sunGlow.addColorStop(1, "rgba(255, 228, 138, 0)");
  ctx.fillStyle = sunGlow;
  ctx.fillRect(270, 0, 220, 220);

  drawCloud(wrap(70 - game.cloudOffset * 0.2, 700) - 90, 130, 1.1);
  drawCloud(wrap(250 - game.cloudOffset * 0.18, 700) - 90, 190, 1.35);
  drawCloud(wrap(480 - game.cloudOffset * 0.24, 720) - 90, 100, 1);
  drawCloud(wrap(620 - game.cloudOffset * 0.15, 760) - 90, 155, 1.25);

  ctx.fillStyle = "#89d4a4";
  ctx.beginPath();
  ctx.moveTo(0, GAME.height - GAME.groundHeight - 32);
  ctx.quadraticCurveTo(140, GAME.height - 230, 290, GAME.height - GAME.groundHeight - 46);
  ctx.quadraticCurveTo(390, GAME.height - 160, GAME.width, GAME.height - GAME.groundHeight - 18);
  ctx.lineTo(GAME.width, GAME.height);
  ctx.lineTo(0, GAME.height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#66bc88";
  ctx.beginPath();
  ctx.moveTo(0, GAME.height - GAME.groundHeight - 14);
  ctx.quadraticCurveTo(120, GAME.height - 180, 220, GAME.height - GAME.groundHeight - 34);
  ctx.quadraticCurveTo(350, GAME.height - 140, GAME.width, GAME.height - GAME.groundHeight - 10);
  ctx.lineTo(GAME.width, GAME.height);
  ctx.lineTo(0, GAME.height);
  ctx.closePath();
  ctx.fill();
}

function drawPipe(rect, isTop) {
  ctx.fillStyle = "#2e834f";
  roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 12, true);
  ctx.fillStyle = "#55b46c";
  roundRect(ctx, rect.x + 10, rect.y, rect.width - 20, rect.height, 10, true);

  const lipY = isTop ? rect.height - 18 : rect.y;
  ctx.fillStyle = "#2e834f";
  roundRect(ctx, rect.x - 6, lipY, rect.width + 12, 18, 8, true);
}

function drawPipes() {
  for (const pipe of game.pipes) {
    const rects = pipeRects(pipe);
    drawPipe(rects.top, true);
    drawPipe(rects.bottom, false);
  }
}

function drawBird() {
  ctx.save();
  ctx.translate(game.bird.x, game.bird.y);
  ctx.rotate((game.bird.tilt * Math.PI) / 180);

  ctx.fillStyle = "#f9dc50";
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f4b43e";
  ctx.beginPath();
  ctx.ellipse(-4, 4, 10, 7, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f17f22";
  ctx.beginPath();
  ctx.moveTo(18, -2);
  ctx.lineTo(34, 2);
  ctx.lineTo(18, 8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(7, -5, 4.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#212121";
  ctx.beginPath();
  ctx.arc(8.4, -5, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawGround() {
  ctx.fillStyle = "#d8b57c";
  ctx.fillRect(0, GAME.height - GAME.groundHeight, GAME.width, GAME.groundHeight);
  ctx.fillStyle = "#be9557";
  ctx.fillRect(0, GAME.height - GAME.groundHeight, GAME.width, 14);

  ctx.strokeStyle = "#e9cd9f";
  ctx.lineWidth = 3;
  for (let x = -34; x < GAME.width + 34; x += 34) {
    ctx.beginPath();
    ctx.moveTo(x - game.floorOffset, GAME.height - 54);
    ctx.lineTo(x + 16 - game.floorOffset, GAME.height - 40);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + 12 - game.floorOffset, GAME.height - 26);
    ctx.lineTo(x + 26 - game.floorOffset, GAME.height - 12);
    ctx.stroke();
  }
}

function drawCanvasOverlay() {
  ctx.textAlign = "center";

  if (state.mode === "auth") {
    ctx.fillStyle = "rgba(255, 250, 235, 0.75)";
    roundRect(ctx, 62, 150, 356, 170, 28, true);
    ctx.fillStyle = "#1f324b";
    ctx.font = "bold 36px Georgia";
    ctx.fillText("Log In To Fly", GAME.width / 2, 215);
    ctx.font = "20px Trebuchet MS";
    ctx.fillStyle = "#52657d";
    ctx.fillText("Use the account panel to create a pilot.", GAME.width / 2, 255);
    ctx.fillText("Your scores will stay on this device.", GAME.width / 2, 285);
  }

  if (state.mode === "menu") {
    ctx.fillStyle = "rgba(255, 250, 235, 0.72)";
    roundRect(ctx, 68, 140, 344, 185, 28, true);
    ctx.fillStyle = "#1f324b";
    ctx.font = "bold 42px Georgia";
    ctx.fillText("Ready?", GAME.width / 2, 205);
    ctx.font = "21px Trebuchet MS";
    ctx.fillStyle = "#52657d";
    ctx.fillText("Tap Start or press Space, Enter, click, or tap.", GAME.width / 2, 248);
    ctx.fillText("Beat your best score and climb the board.", GAME.width / 2, 282);
  }

  if (state.mode === "gameover") {
    ctx.fillStyle = "rgba(255, 247, 232, 0.7)";
    ctx.fillRect(0, 0, GAME.width, GAME.height);
    ctx.fillStyle = "rgba(255, 250, 240, 0.9)";
    roundRect(ctx, 78, 170, 324, 210, 28, true);
    ctx.fillStyle = "#1f324b";
    ctx.font = "bold 40px Georgia";
    ctx.fillText("Round Over", GAME.width / 2, 230);
    ctx.font = "bold 28px Trebuchet MS";
    ctx.fillStyle = "#8b4a09";
    ctx.fillText(`Score: ${game.score}`, GAME.width / 2, 275);
    ctx.font = "20px Trebuchet MS";
    ctx.fillStyle = "#52657d";
    ctx.fillText("Press Start, Space, Enter, click, or tap.", GAME.width / 2, 322);
    ctx.fillText("Your best score updates in the profile panel.", GAME.width / 2, 352);
  }

  if (state.mode === "playing") {
    ctx.fillStyle = "#fffaf2";
    ctx.font = "bold 48px Georgia";
    ctx.fillText(String(game.score), GAME.width / 2, 72);
  }
}

function roundRect(context, x, y, width, height, radius, fill) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
  if (fill) {
    context.fill();
  } else {
    context.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, GAME.width, GAME.height);
  drawBackground();
  drawPipes();
  drawBird();
  drawGround();
  drawCanvasOverlay();
}

function gameLoop(timestamp) {
  if (!game.lastFrameTime) {
    game.lastFrameTime = timestamp;
  }

  const deltaMs = Math.min(34, timestamp - game.lastFrameTime);
  game.lastFrameTime = timestamp;
  updateGame(deltaMs);
  draw();
  requestAnimationFrame(gameLoop);
}

function handleActionInput() {
  if (state.mode === "playing") {
    flap();
    return;
  }

  if (state.mode === "menu") {
    startGame();
    return;
  }

  if (state.mode === "gameover") {
    startGame();
  }
}

ui.authForm.addEventListener("submit", submitAuth);
ui.loginTab.addEventListener("click", () => switchAuthMode("login"));
ui.registerTab.addEventListener("click", () => switchAuthMode("register"));
ui.startButton.addEventListener("click", startGame);
ui.logoutButton.addEventListener("click", logout);
ui.exitViewButton.addEventListener("click", leavePlayView);
ui.heroInstallButton.addEventListener("click", handleInstallRequest);
ui.installButton.addEventListener("click", handleInstallRequest);
ui.installBannerButton.addEventListener("click", handleInstallRequest);
ui.installBannerClose.addEventListener("click", dismissInstallNotice);
ui.installGateButton.addEventListener("click", handleInstallRequest);
ui.continueWebButton.addEventListener("click", continueOnWeb);

canvas.addEventListener("pointerdown", () => {
  canvas.focus({ preventScroll: true });
  handleActionInput();
});

window.addEventListener("keydown", (event) => {
  const isTextInput = document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName);

  if (event.key === "Escape" && state.mode === "gameover") {
    setMode("menu");
    setMessage("Back at the menu. Start again whenever you want.", "info");
    renderAll();
    return;
  }

  if (isTextInput) {
    return;
  }

  if (event.code === "Space" || event.key === "Enter") {
    event.preventDefault();
    handleActionInput();
  }
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installState.deferredPrompt = event;
  installState.dismissed = false;
  renderAll();
});

window.addEventListener("appinstalled", () => {
  installState.deferredPrompt = null;
  installState.dismissed = true;
  renderAll();
  setMessage("App installed. Launch it from your home screen anytime.", "success");
});

window.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement) {
    return;
  }

  if (viewState.immersive && !shouldUseImmersivePlayView()) {
    setImmersiveView(false);
    renderAll();
  }
});

window.addEventListener("resize", () => {
  if (viewState.immersive && !isLikelyMobileDevice()) {
    exitMobilePlayView();
  }
  renderAll();
});

window.addEventListener("offline", () => {
  setMessage("You are offline. The cached app can still run, but new updates need a connection.", "error");
});

window.addEventListener("online", () => {
  setMessage("Connection restored.", "success");
});

switchAuthMode("login");
renderAll();

if (!storageState.supported) {
  setMessage("Local storage is unavailable, so scores last only while this tab stays open.", "error");
}

handleLaunchShortcut();

if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      renderInstallCta();
    });
  });
}

requestAnimationFrame(gameLoop);
