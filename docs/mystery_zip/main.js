(() => {
  document.documentElement.classList.add("preload");

  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+-=?@{}";
  const bruteLength = 20;
  const PBKDF2_ITERATIONS = 1000;
  const AUTH_CODE_LENGTH = 10;
  const PASSWORD_VERIFY_LENGTH = 2;
  const AES_EXTRA_FIELD_ID = 0x9901;
  const PROGRESS_PRECISION = 6n;
  const STORAGE_PASSWORD_KEY = "mysteryZipPassword";
  const STORAGE_ARCHIVE_KEY = "mysteryZipArchiveData";
  const STORAGE_BRUTEFORCE_KEY = "mysteryZipBruteforceState";
  const STORAGE_SCENE_OPENED_KEY = "mysteryZipSceneOpened";
  const BRUTEFORCE_BATCH_SIZE = 250;
  const SUCCESS_STATUS_MESSAGE = "Архив разблокирован. Введённый пароль подошёл к реальному ZIP.";
  const RESTORED_PASSWORD_MESSAGE = "Верный пароль уже найден и восстановлен из localStorage.";
  const AES_KEY_LENGTH_BY_STRENGTH = {
    1: 16,
    2: 24,
    3: 32
  };
  const SALT_LENGTH_BY_STRENGTH = {
    1: 8,
    2: 12,
    3: 16
  };

  const scene = document.getElementById("scene");
  const archiveTrigger = document.getElementById("archiveTrigger");
  const downloadButton = document.getElementById("downloadButton");
  const loadButton = document.getElementById("loadButton");
  const fileInput = document.getElementById("fileInput");
  const rightPanel = document.getElementById("rightPanel");
  const passwordInput = document.getElementById("passwordInput");
  const unlockButton = document.getElementById("unlockButton");
  const bruteforceButton = document.getElementById("bruteforceButton");
  const terminal = document.getElementById("terminal");
  const attemptCounter = document.getElementById("attemptCounter");
  const modeLabel = document.getElementById("modeLabel");
  const successBanner = document.getElementById("successBanner");
  const storedPasswordBanner = document.getElementById("storedPasswordBanner");
  const totalVariants = BigInt(charset.length) ** BigInt(bruteLength);

  let archiveData = null;
  let attempts = 0;
  let unlocked = false;
  let bruteRunning = false;
  let sceneOpened = false;
  let terminalScrollFrame = 0;
  let storedPassword = null;
  let bruteforceWorker = null;
  let bruteforceWorkerUrl = null;
  let bruteforceState = null;

  function readStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function writeStorage(key, value, warningMessage) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      if (warningMessage) {
        appendLine(warningMessage);
      }

      return false;
    }
  }

  function removeStorage(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      // Ignore storage cleanup errors.
    }
  }

  function scheduleTerminalScroll() {
    if (terminalScrollFrame) {
      return;
    }

    terminalScrollFrame = window.requestAnimationFrame(() => {
      terminal.scrollTop = terminal.scrollHeight;
      terminalScrollFrame = 0;
    });
  }

  function appendLine(text, className = "") {
    const line = document.createElement("div");
    if (className) {
      line.className = className;
    }
    line.textContent = text;
    terminal.appendChild(line);
    scheduleTerminalScroll();
  }

  function replaceTerminal(text) {
    terminal.textContent = "";
    appendLine(text);
  }

  function persistSceneOpened() {
    writeStorage(STORAGE_SCENE_OPENED_KEY, "true");
  }

  function openScene(options = {}) {
    const { persist = true } = options;

    if (sceneOpened) {
      return;
    }

    sceneOpened = true;
    scene.classList.add("is-open");
    archiveTrigger.setAttribute("aria-expanded", "true");

    if (persist) {
      persistSceneOpened();
    }
  }

  function restoreSceneOpened() {
    const isSceneOpened = readStorage(STORAGE_SCENE_OPENED_KEY) === "true";

    if (isSceneOpened) {
      openScene({ persist: false });
    }
  }

  function revealPage() {
    document.documentElement.classList.remove("preload");
  }

  function setArchiveUnlockedState(value) {
    scene.classList.toggle("is-unlocked", value);
  }

  function setLoadButtonVisibility(visible) {
    loadButton.classList.toggle("hidden", !visible);
  }

  function syncKnownPasswordPanel() {
    if (!rightPanel) {
      return;
    }

    rightPanel.classList.toggle("has-known-password", Boolean(storedPassword));

    if (!storedPasswordBanner) {
      return;
    }

    if (storedPassword) {
      storedPasswordBanner.textContent = `Пароль: ${storedPassword}`;
      storedPasswordBanner.classList.remove("hidden");
      return;
    }

    storedPasswordBanner.textContent = "";
    storedPasswordBanner.classList.add("hidden");
  }

  function syncSuccessBanner() {
    if (!successBanner) {
      return;
    }

    if (storedPassword) {
      successBanner.textContent = RESTORED_PASSWORD_MESSAGE;
      successBanner.classList.remove("hidden");
      return;
    }

    successBanner.textContent = SUCCESS_STATUS_MESSAGE;
    successBanner.classList.add("hidden");
  }

  function syncUnlockedUi() {
    const hasKnownPassword = Boolean(storedPassword);
    const isResolved = unlocked || hasKnownPassword;
    setArchiveUnlockedState(isResolved);
    setLoadButtonVisibility(!isResolved);
    syncKnownPasswordPanel();
    syncSuccessBanner();
  }

  function restoreStoredPassword() {
    storedPassword = readStorage(STORAGE_PASSWORD_KEY);
    syncUnlockedUi();
  }

  function persistFoundPassword(password) {
    if (writeStorage(STORAGE_PASSWORD_KEY, password, "[warn] Не удалось сохранить пароль в localStorage.")) {
      storedPassword = password;
    }

    syncUnlockedUi();
  }

  function uint8ToBase64(bytes) {
    let binary = "";
    const chunkSize = 0x8000;

    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, offset + chunkSize);
      binary += String.fromCharCode(...chunk);
    }

    return window.btoa(binary);
  }

  function base64ToUint8(value) {
    const binary = window.atob(value);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
  }

  function serializeArchiveData(data) {
    return JSON.stringify({
      salt: uint8ToBase64(data.salt),
      passwordVerification: uint8ToBase64(data.passwordVerification),
      encryptedPayload: uint8ToBase64(data.encryptedPayload),
      authCode: uint8ToBase64(data.authCode),
      keyLength: data.keyLength
    });
  }

  function deserializeArchiveData(serialized) {
    const parsed = JSON.parse(serialized);

    return {
      salt: base64ToUint8(parsed.salt),
      passwordVerification: base64ToUint8(parsed.passwordVerification),
      encryptedPayload: base64ToUint8(parsed.encryptedPayload),
      authCode: base64ToUint8(parsed.authCode),
      keyLength: parsed.keyLength
    };
  }

  function createInitialBruteforceState() {
    return {
      indices: Array(bruteLength).fill(0),
      attempts: 0,
      active: false
    };
  }

  function persistArchiveData() {
    if (!archiveData) {
      return;
    }

    writeStorage(
      STORAGE_ARCHIVE_KEY,
      serializeArchiveData(archiveData),
      "[warn] Не удалось сохранить архив для возобновления brute force."
    );
  }

  function clearPersistedArchiveData() {
    removeStorage(STORAGE_ARCHIVE_KEY);
  }

  function persistBruteforceState() {
    if (!bruteforceState) {
      return;
    }

    writeStorage(
      STORAGE_BRUTEFORCE_KEY,
      JSON.stringify(bruteforceState),
      "[warn] Не удалось сохранить состояние brute force."
    );
  }

  function resetBruteforceState() {
    bruteforceState = createInitialBruteforceState();
    persistBruteforceState();
  }

  function markBruteforceStateActive(active) {
    if (!bruteforceState) {
      bruteforceState = createInitialBruteforceState();
    }

    bruteforceState.active = active;
    persistBruteforceState();
  }

  function restoreArchiveData() {
    try {
      const serializedArchive = readStorage(STORAGE_ARCHIVE_KEY);
      if (!serializedArchive) {
        return false;
      }

      archiveData = deserializeArchiveData(serializedArchive);
      return true;
    } catch (error) {
      archiveData = null;
      clearPersistedArchiveData();
      return false;
    }
  }

  function restoreBruteforceState() {
    try {
      const serializedState = readStorage(STORAGE_BRUTEFORCE_KEY);
      if (!serializedState) {
        resetBruteforceState();
        return;
      }

      const parsedState = JSON.parse(serializedState);
      if (!Array.isArray(parsedState.indices) || parsedState.indices.length !== bruteLength) {
        resetBruteforceState();
        return;
      }

      bruteforceState = {
        indices: parsedState.indices.map((value) => Number(value) || 0),
        attempts: Number(parsedState.attempts) || 0,
        active: Boolean(parsedState.active)
      };
    } catch (error) {
      resetBruteforceState();
    }
  }

  function updateBruteforceButton() {
    if (bruteRunning) {
      bruteforceButton.textContent = "Остановить brute force";
      bruteforceButton.disabled = false;
      return;
    }

    bruteforceButton.textContent = "Запустить brute force";
    bruteforceButton.disabled = !archiveData || unlocked;
  }

  function setControlsEnabled(enabled) {
    passwordInput.disabled = !enabled;
    unlockButton.disabled = !enabled || unlocked;
    updateBruteforceButton();
  }

  function updateAttemptLabel() {
    attemptCounter.textContent = `Попыток: ${attempts.toLocaleString("ru-RU")}`;
  }

  function updateProgressLabel() {
    if (attempts === 0) {
      modeLabel.textContent = "Проверено: 0 %";
      return;
    }

    const progressPercent = (attempts / Number(totalVariants)) * 100;
    const formattedPercent = progressPercent >= 0.000001
      ? progressPercent.toFixed(Number(PROGRESS_PRECISION))
      : progressPercent.toExponential(Number(PROGRESS_PRECISION));

    modeLabel.textContent = `Проверено: ${formattedPercent} %`;
  }

  function renderAttemptStats() {
    updateAttemptLabel();
    updateProgressLabel();
  }

  function setAttempts(nextAttempts) {
    attempts = nextAttempts;
    renderAttemptStats();
  }

  function incrementAttempts(delta = 1) {
    if (!delta) {
      return;
    }

    setAttempts(attempts + delta);
  }

  function terminateBruteforceWorker() {
    if (bruteforceWorker) {
      bruteforceWorker.terminate();
      bruteforceWorker = null;
    }

    if (bruteforceWorkerUrl) {
      URL.revokeObjectURL(bruteforceWorkerUrl);
      bruteforceWorkerUrl = null;
    }
  }

  function stopBruteforce() {
    bruteRunning = false;
    terminateBruteforceWorker();
    markBruteforceStateActive(false);
    updateBruteforceButton();
  }

  function handleSuccess(source, password) {
    unlocked = true;
    persistFoundPassword(password);
    stopBruteforce();
    resetBruteforceState();
    successBanner.textContent = SUCCESS_STATUS_MESSAGE;
    successBanner.classList.remove("hidden");
    appendLine(`[success] Пароль принят (${source}): ${password}`, "pass");
    setControlsEnabled(true);
  }

  function readUint16(view, offset) {
    return view.getUint16(offset, true);
  }

  function readUint32(view, offset) {
    return view.getUint32(offset, true);
  }

  function arraysEqual(a, b) {
    if (a.length !== b.length) {
      return false;
    }

    let mismatch = 0;
    for (let i = 0; i < a.length; i += 1) {
      mismatch |= a[i] ^ b[i];
    }

    return mismatch === 0;
  }

  function parseArchive(buffer) {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);

    if (readUint32(view, 0) !== 0x04034b50) {
      throw new Error("Локальный заголовок ZIP не найден.");
    }

    const compressionMethod = readUint16(view, 8);
    const compressedSize = readUint32(view, 18);
    const fileNameLength = readUint16(view, 26);
    const extraLength = readUint16(view, 28);
    const extraOffset = 30 + fileNameLength;
    const dataOffset = extraOffset + extraLength;

    if (compressionMethod !== 99) {
      throw new Error("Поддерживается только ZIP AES (method 99).");
    }

    let cursor = extraOffset;
    let aesStrength = null;

    while (cursor < dataOffset) {
      const headerId = readUint16(view, cursor);
      const fieldSize = readUint16(view, cursor + 2);

      if (headerId === AES_EXTRA_FIELD_ID) {
        aesStrength = bytes[cursor + 8];
        break;
      }

      cursor += 4 + fieldSize;
    }

    if (!aesStrength || !AES_KEY_LENGTH_BY_STRENGTH[aesStrength]) {
      throw new Error("Не удалось прочитать параметры AES из ZIP.");
    }

    const keyLength = AES_KEY_LENGTH_BY_STRENGTH[aesStrength];
    const saltLength = SALT_LENGTH_BY_STRENGTH[aesStrength];

    const saltStart = dataOffset;
    const passwordVerifyStart = saltStart + saltLength;
    const cipherStart = passwordVerifyStart + PASSWORD_VERIFY_LENGTH;
    const authCodeStart = dataOffset + compressedSize - AUTH_CODE_LENGTH;

    if (authCodeStart <= cipherStart) {
      throw new Error("Некорректная структура зашифрованного ZIP.");
    }

    return {
      salt: bytes.slice(saltStart, passwordVerifyStart),
      passwordVerification: bytes.slice(passwordVerifyStart, cipherStart),
      encryptedPayload: bytes.slice(cipherStart, authCodeStart),
      authCode: bytes.slice(authCodeStart, authCodeStart + AUTH_CODE_LENGTH),
      keyLength
    };
  }

  async function deriveAesMaterial(password, archive) {
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(password);
    const baseKey = await crypto.subtle.importKey(
      "raw",
      passwordBytes,
      "PBKDF2",
      false,
      ["deriveBits"]
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-1",
        salt: archive.salt,
        iterations: PBKDF2_ITERATIONS
      },
      baseKey,
      (archive.keyLength * 2 + PASSWORD_VERIFY_LENGTH) * 8
    );

    const derived = new Uint8Array(derivedBits);

    return {
      authKey: derived.slice(archive.keyLength, archive.keyLength * 2),
      passwordVerification: derived.slice(archive.keyLength * 2)
    };
  }

  async function verifyPassword(password) {
    if (!archiveData) {
      throw new Error("Архив не загружен.");
    }

    const derived = await deriveAesMaterial(password, archiveData);
    if (!arraysEqual(derived.passwordVerification, archiveData.passwordVerification)) {
      return false;
    }

    const hmacKey = await crypto.subtle.importKey(
      "raw",
      derived.authKey,
      {
        name: "HMAC",
        hash: "SHA-1"
      },
      false,
      ["sign"]
    );

    const signature = new Uint8Array(
      await crypto.subtle.sign("HMAC", hmacKey, archiveData.encryptedPayload)
    ).slice(0, AUTH_CODE_LENGTH);

    return arraysEqual(signature, archiveData.authCode);
  }

  async function processAttempt(password, source, options = {}) {
    const {
      countAttempt = true,
      logFailure = false
    } = options;

    const matched = await verifyPassword(password);
    if (matched) {
      if (countAttempt) {
        incrementAttempts();
      }
      handleSuccess(source, password);
      return true;
    }

    if (countAttempt) {
      incrementAttempts();
    }

    if (logFailure) {
      appendLine(`[fail] ${password}`, "fail");
    }

    return false;
  }

  function createBruteforceWorker() {
    const workerSource = `
      const PBKDF2_ITERATIONS = ${PBKDF2_ITERATIONS};
      const AUTH_CODE_LENGTH = ${AUTH_CODE_LENGTH};
      const PASSWORD_VERIFY_LENGTH = ${PASSWORD_VERIFY_LENGTH};

      function createBruteforceState(length, alphabet, initialIndices = null) {
        return {
          alphabet,
          indices: initialIndices ? [...initialIndices] : Array(length).fill(0),
          finished: false
        };
      }

      function nextPassword(state) {
        if (state.finished) {
          return null;
        }

        const value = state.indices.map((index) => state.alphabet[index]).join("");

        for (let cursor = state.indices.length - 1; cursor >= 0; cursor -= 1) {
          if (state.indices[cursor] < state.alphabet.length - 1) {
            state.indices[cursor] += 1;
            for (let reset = cursor + 1; reset < state.indices.length; reset += 1) {
              state.indices[reset] = 0;
            }
            return value;
          }
        }

        state.finished = true;
        return value;
      }

      function arraysEqual(a, b) {
        if (a.length !== b.length) {
          return false;
        }

        let mismatch = 0;
        for (let i = 0; i < a.length; i += 1) {
          mismatch |= a[i] ^ b[i];
        }

        return mismatch === 0;
      }

      async function deriveAesMaterial(password, archive) {
        const encoder = new TextEncoder();
        const passwordBytes = encoder.encode(password);
        const baseKey = await crypto.subtle.importKey(
          "raw",
          passwordBytes,
          "PBKDF2",
          false,
          ["deriveBits"]
        );

        const derivedBits = await crypto.subtle.deriveBits(
          {
            name: "PBKDF2",
            hash: "SHA-1",
            salt: archive.salt,
            iterations: PBKDF2_ITERATIONS
          },
          baseKey,
          (archive.keyLength * 2 + PASSWORD_VERIFY_LENGTH) * 8
        );

        const derived = new Uint8Array(derivedBits);

        return {
          authKey: derived.slice(archive.keyLength, archive.keyLength * 2),
          passwordVerification: derived.slice(archive.keyLength * 2)
        };
      }

      async function verifyPassword(password, archive) {
        const derived = await deriveAesMaterial(password, archive);
        if (!arraysEqual(derived.passwordVerification, archive.passwordVerification)) {
          return false;
        }

        const hmacKey = await crypto.subtle.importKey(
          "raw",
          derived.authKey,
          {
            name: "HMAC",
            hash: "SHA-1"
          },
          false,
          ["sign"]
        );

        const signature = new Uint8Array(
          await crypto.subtle.sign("HMAC", hmacKey, archive.encryptedPayload)
        ).slice(0, AUTH_CODE_LENGTH);

        return arraysEqual(signature, archive.authCode);
      }

      async function runJob(payload) {
        const state = createBruteforceState(payload.bruteLength, payload.charset, payload.initialIndices);
        const archive = payload.archive;

        while (true) {
          let processed = 0;

          for (; processed < payload.batchSize; processed += 1) {
            const candidate = nextPassword(state);
            if (candidate === null) {
              self.postMessage({
                type: "exhausted",
                attemptsDelta: processed,
                indices: state.indices
              });
              return;
            }

            const matched = await verifyPassword(candidate, archive);
            if (matched) {
              self.postMessage({
                type: "success",
                attemptsDelta: processed + 1,
                password: candidate,
                indices: state.indices
              });
              return;
            }
          }

          self.postMessage({
            type: "progress",
            attemptsDelta: processed,
            indices: state.indices
          });

          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      self.addEventListener("message", async (event) => {
        if (event.data.type !== "start") {
          return;
        }

        try {
          await runJob(event.data);
        } catch (error) {
          self.postMessage({
            type: "error",
            message: error instanceof Error ? error.message : String(error)
          });
        }
      });
    `;

    bruteforceWorkerUrl = URL.createObjectURL(
      new Blob([workerSource], { type: "text/javascript" })
    );

    return new Worker(bruteforceWorkerUrl);
  }

  function updateAttemptsBy(delta) {
    incrementAttempts(delta);
  }

  function syncAttemptsFromState() {
    setAttempts(bruteforceState ? bruteforceState.attempts : 0);
  }

  function startBruteforceWorker() {
    terminateBruteforceWorker();
    bruteforceWorker = createBruteforceWorker();

    bruteforceWorker.addEventListener("message", (event) => {
      const {
        type,
        attemptsDelta = 0,
        password,
        message,
        indices
      } = event.data;

      if (!bruteRunning && type !== "error") {
        return;
      }

      if (bruteforceState && Array.isArray(indices) && indices.length === bruteLength) {
        bruteforceState.indices = [...indices];
      }

      updateAttemptsBy(attemptsDelta);
      if (bruteforceState) {
        bruteforceState.attempts = attempts;
        persistBruteforceState();
      }

      if (type === "progress") {
        return;
      }

      if (type === "success") {
        handleSuccess("автоматический перебор", password);
        return;
      }

      if (type === "exhausted") {
        stopBruteforce();
        resetBruteforceState();
        appendLine("[system] Пространство заданного перебора закончено.");
        return;
      }

      if (type === "error") {
        stopBruteforce();
        appendLine(`[error] ${message}`, "fail");
      }
    });

    bruteforceWorker.postMessage({
      type: "start",
      archive: archiveData,
      charset,
      bruteLength,
      batchSize: BRUTEFORCE_BATCH_SIZE,
      initialIndices: bruteforceState ? bruteforceState.indices : Array(bruteLength).fill(0)
    });
  }

  async function loadArchiveFromBuffer(buffer, sourceLabel) {
    stopBruteforce();
    archiveData = parseArchive(buffer);
    persistArchiveData();
    unlocked = Boolean(storedPassword);
    syncUnlockedUi();
    resetBruteforceState();
    syncAttemptsFromState();
    passwordInput.value = "";
    syncSuccessBanner();
    setControlsEnabled(true);
    replaceTerminal("[system] Архив получен.");
  }

  async function handleFile(file) {
    try {
      const buffer = await file.arrayBuffer();
      await loadArchiveFromBuffer(buffer, file.name);
    } catch (error) {
      setControlsEnabled(false);
      appendLine(`[error] ${error.message}`, "fail");
    }
  }

  function downloadArchive() {
    openScene();
    const link = document.createElement("a");
    link.href = "./mystery.zip";
    link.download = "mystery.zip";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function loadBundledArchive() {
    const response = await fetch("./mystery.zip", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    await loadArchiveFromBuffer(buffer, "mystery.zip");
  }

  function toggleBruteforce() {
    if (bruteRunning) {
      stopBruteforce();
      appendLine("[system] Перебор остановлен пользователем.");
      return;
    }

    if (!archiveData || unlocked) {
      return;
    }

    bruteRunning = true;
    markBruteforceStateActive(true);
    updateBruteforceButton();
    appendLine("[system] Запущен перебор в Web Worker.");
    startBruteforceWorker();
  }

  archiveTrigger.addEventListener("click", openScene);
  downloadButton.addEventListener("click", downloadArchive);

  loadButton.addEventListener("click", async () => {
    openScene();

    try {
      await loadBundledArchive();
    } catch (error) {
      appendLine("[system] Не удалось автоматически прочитать ./mystery.zip. Выберите файл вручную.");
      appendLine(`[error] ${error.message}`, "fail");
      fileInput.click();
    }
  });

  fileInput.addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) {
      return;
    }

    await handleFile(file);
    fileInput.value = "";
  });

  unlockButton.addEventListener("click", async () => {
    if (!archiveData || unlocked) {
      return;
    }

    const password = passwordInput.value;
    if (!password) {
      appendLine("[system] Введите пароль перед проверкой.");
      return;
    }

    try {
      const matched = await processAttempt(password, "ручной ввод", {
        countAttempt: false,
        logFailure: true
      });
      void matched;
    } catch (error) {
      appendLine(`[error] ${error.message}`, "fail");
    }
  });

  passwordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      unlockButton.click();
    }
  });

  bruteforceButton.addEventListener("click", toggleBruteforce);

  restoreSceneOpened();
  restoreStoredPassword();
  restoreBruteforceState();
  if (restoreArchiveData()) {
    syncAttemptsFromState();
    setControlsEnabled(true);
    replaceTerminal("[system] Архив и состояние перебора восстановлены.");

    if (bruteforceState && bruteforceState.active && !storedPassword) {
      bruteRunning = true;
      updateBruteforceButton();
      appendLine("[system] Brute force автоматически возобновлён после перезагрузки.");
      startBruteforceWorker();
    }
  } else {
    resetBruteforceState();
    syncAttemptsFromState();
    setControlsEnabled(false);
  }
  updateBruteforceButton();
  revealPage();
})();
