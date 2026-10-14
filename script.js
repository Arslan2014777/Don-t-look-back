
/* ===== DON'T LOOK BACK: SOUND SYSTEM ===== */

const gameSounds = {
  ambient: new Audio("./sounds/ambient.mp3"),
  footsteps: new Audio("./sounds/footsteps.mp3"),
  jumpscare: new Audio("./sounds/jumpscare.mp3"),
  monster: new Audio("./sounds/monster.mp3")
};

let gameSoundEnabled = true;
let monsterSoundTimer = null;

gameSounds.ambient.loop = true;
gameSounds.ambient.volume = 0.22;

gameSounds.footsteps.loop = true;
gameSounds.footsteps.volume = 0.45;

gameSounds.jumpscare.volume = 0.65;
gameSounds.monster.loop = true;
gameSounds.monster.volume = 0.4;

// Безопасно запускаем звук
function playGameSound(name) {
  if (!gameSoundEnabled) return;

  const sound = gameSounds[name];
  if (!sound) return;

  sound.play().catch(error => {
    console.warn("Не удалось воспроизвести звук:", name, error);
  });
}

// Запуск фоновой атмосферы
function startGameSounds() {
  if (!gameSoundEnabled) return;

  playGameSound("ambient");
}

// Шаги игрока
function startPlayerFootsteps() {
  if (!gameSoundEnabled) return;
  if (gameSounds.footsteps.paused) {
    playGameSound("") ;
  }
}

function stopPlayerFootsteps() {
  gameSounds.footsteps.pause();
  gameSounds.footsteps.currentTime = 0;
}

// Монстр приблизился
function startMonsterSounds() {
  if (!gameSoundEnabled) return;
  playGameSound("beast-roar");
}

function stopMonsterSounds() {
  gameSounds.monster.pause();
  gameSounds.monster.currentTime = 0;
}

// Игрок проиграл
function playMonsterJumpscare() {
  stopPlayerFootsteps();
  stopMonsterSounds();

  gameSounds.jumpscare.currentTime = 0;
  playGameSound("jumpscare");
}

// Включение и выключение всех звуков
function toggleGameSounds() {
  gameSoundEnabled = !gameSoundEnabled;

  if (!gameSoundEnabled) {
    Object.values(gameSounds).forEach(sound => {
      sound.pause();
    });
  } else {
    startGameSounds();
  }

  const button = document.getElementById("sound");
  if (button) {
    button.textContent = gameSoundEnabled
      ? "🔊 ЗВУК: ВКЛ"
      : "🔇 ЗВУК: ВЫКЛ";
  }
}

// Громкость зависит от расстояния до монстра
function updateMonsterSound(distance, maxDistance = 12) {
  if (!gameSoundEnabled) return;

  const proximity = Math.max(
    0,
    Math.min(1, 1 - distance / maxDistance)
  );

  gameSounds.monster.volume = 0.05 + proximity * 0.65;

  if (proximity > 0.05) {
    if (gameSounds.monster.paused) {
      playGameSound("monster");
    }
  } else {
    stopMonsterSounds();
  }
}
