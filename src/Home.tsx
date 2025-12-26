import { useState, useRef, useEffect } from 'react';
import './styles/game.css';

interface House {
  id: number;
  character: 'grinch' | 'santa' | null;
  isVisible: boolean;
  hitBubble: boolean;
}

export default function Home() {
  const baseUrl = import.meta.env.BASE_URL;
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('whackAMoleHighScore');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameActive, setGameActive] = useState(false);
  const [gameover, setGameover] = useState(false);
  const [houses, setHouses] = useState<House[]>(
    Array.from({ length: 5 }, (_, i) => ({
      id: i,
      character: null,
      isVisible: false,
      hitBubble: false,
    }))
  );
  const [isMuted, setIsMuted] = useState(false);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentTempoRef = useRef(1);
  const gameActiveRef = useRef(false);
  const houseStateRef = useRef<House[]>(houses);

  // Update house state ref
  useEffect(() => {
    houseStateRef.current = houses;
  }, [houses]);

  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }, []);

  // Play boop sound effect
  const playBoop = () => {
    if (isMuted || !audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.start(now);
    osc.stop(now + 0.1);
  };

  // Play Jingle Bells melody - full version
  const playJingleBells = () => {
    if (isMuted || !audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    const tempo = currentTempoRef.current;
    const beatDuration = (0.4 / tempo); // in seconds

    // Full Jingle Bells melody (E E E, E E E, E G C D E)
    const notes = [
      { freq: 330, duration: beatDuration }, // E
      { freq: 330, duration: beatDuration }, // E
      { freq: 330, duration: beatDuration * 1.5 }, // E (longer)
      { freq: 330, duration: beatDuration }, // E
      { freq: 330, duration: beatDuration }, // E
      { freq: 330, duration: beatDuration * 1.5 }, // E (longer)
      { freq: 330, duration: beatDuration }, // E
      { freq: 392, duration: beatDuration }, // G
      { freq: 262, duration: beatDuration }, // C
      { freq: 294, duration: beatDuration }, // D
      { freq: 330, duration: beatDuration * 2 }, // E (even longer)
    ];

    let currentTime = now;
    notes.forEach(({ freq, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.setValueAtTime(freq, currentTime);
      gain.gain.setValueAtTime(0.25, currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, currentTime + duration);

      osc.start(currentTime);
      osc.stop(currentTime + duration);

      currentTime += duration;
    });
  };

  // Start game
  const startGame = () => {
    setScore(0);
    setTimeLeft(60);
    setGameActive(true);
    gameActiveRef.current = true;
    setGameover(false);
    currentTempoRef.current = 1;
    playJingleBells();

    // Timer
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setGameActive(false);
          gameActiveRef.current = false;
          setGameover(true);
          if (timerRef.current) clearInterval(timerRef.current);
          if (gameLoopRef.current) clearTimeout(gameLoopRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Restart game (called during gameplay)
  const restartGame = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (gameLoopRef.current) clearTimeout(gameLoopRef.current);
    setHouses(
      Array.from({ length: 5 }, (_, i) => ({
        id: i,
        character: null,
        isVisible: false,
        hitBubble: false,
      }))
    );
    startGame();
  };

  // Handle character hit
  const handleHit = (houseId: number) => {
    if (!gameActiveRef.current) return;

    const house = houseStateRef.current.find((h) => h.id === houseId);
    if (!house || !house.isVisible || !house.character) return;

    playBoop();

    const points = house.character === 'grinch' ? 1 : -1;
    setScore((prevScore) => Math.max(0, prevScore + points));

    // Show hit bubble
    setHouses((prev) =>
      prev.map((h) =>
        h.id === houseId
          ? { ...h, isVisible: false, character: null, hitBubble: true }
          : h
      )
    );

    // Hide bubble after animation
    setTimeout(() => {
      setHouses((current) =>
        current.map((h) =>
          h.id === houseId ? { ...h, hitBubble: false } : h
        )
      );
    }, 600);
  };

  // Game loop - spawn characters
  useEffect(() => {
    if (!gameActive) return;

    const spawnCharacter = () => {
      const elapsed = 60 - timeLeft;
      let spawnDelay = 1500;
      let visibleDuration = 1000;
      let santaProbability = 0.3;

      if (elapsed >= 40) {
        spawnDelay = 500;
        visibleDuration = 350;
        santaProbability = 0.15;
      } else if (elapsed >= 20) {
        spawnDelay = 900;
        visibleDuration = 550;
        santaProbability = 0.2;
      }

      // Ensure minimum visible time
      visibleDuration = Math.max(visibleDuration, 250);

      const randomHouse = Math.floor(Math.random() * 5);
      const isSanta = Math.random() < santaProbability;
      const character = isSanta ? 'santa' : 'grinch';

      setHouses((prev) =>
        prev.map((h) =>
          h.id === randomHouse
            ? { ...h, character, isVisible: true, hitBubble: false }
            : h
        )
      );

      // Hide character after visible duration
      setTimeout(() => {
        setHouses((prev) =>
          prev.map((h) =>
            h.id === randomHouse && h.character === character
              ? { ...h, isVisible: false, character: null }
              : h
          )
        );
      }, visibleDuration);

      gameLoopRef.current = setTimeout(spawnCharacter, spawnDelay + Math.random() * 200);
    };

    gameLoopRef.current = setTimeout(spawnCharacter, 800);

    return () => {
      if (gameLoopRef.current) clearTimeout(gameLoopRef.current);
    };
  }, [gameActive, timeLeft]);

  // Increase tempo at milestones
  useEffect(() => {
    const elapsed = 60 - timeLeft;
    if (elapsed === 20 || elapsed === 40) {
      currentTempoRef.current = elapsed === 20 ? 1.5 : 2;
      playJingleBells();
    }
  }, [timeLeft]);

  // Update high score
  useEffect(() => {
    if (gameover && score > highScore) {
      setHighScore(score);
      localStorage.setItem('whackAMoleHighScore', score.toString());
    }
  }, [gameover, score, highScore]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (gameLoopRef.current) clearTimeout(gameLoopRef.current);
      gameActiveRef.current = false;
    };
  }, []);

  return (
    <div className="game-container">
      <div
        className="game-background"
        style={{ backgroundImage: `url(${baseUrl}images/background.png)` }}
      />

      <div className="game-content">
        {/* Header */}
        <header className="game-header">
          <h1>🎄 Christmas Whack-a-Mole 🎄</h1>
          <div className="header-controls">
            <div className="score-display">
              <div className="score-item">
                <span className="label">Score:</span>
                <span className="value">{score}</span>
              </div>
              <div className="score-item">
                <span className="label">Best:</span>
                <span className="value">{highScore}</span>
              </div>
            </div>
            <div className="timer-display">{timeLeft}s</div>
            <div className="header-buttons">
              {gameActive && (
                <button
                  className="restart-button"
                  onClick={restartGame}
                  title="Restart Game"
                >
                  🔄
                </button>
              )}
              <button
                className="mute-button"
                onClick={() => setIsMuted(!isMuted)}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? '🔇' : '🔊'}
              </button>
            </div>
          </div>
        </header>

        {/* Game Board */}
        <main className="game-board">
          {houses.map((house) => (
            <div
              key={house.id}
              className="house-slot"
              onClick={() => handleHit(house.id)}
            >
              <div className="house-container">
                <img
                  src={`${baseUrl}images/snow-house.png`}
                  alt="Snow House"
                  className="house-image"
                />
                {house.isVisible && house.character && (
                  <div className="character-wrapper">
                    <img
                      src={`${baseUrl}images/${house.character}.png`}
                      alt={house.character}
                      className="character-image"
                    />
                  </div>
                )}
                {house.hitBubble && (
                  <div className="hit-bubble">
                    <img
                      src={`${baseUrl}images/ouch-bubble.png`}
                      alt="OUCH!"
                      className="ouch-bubble"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </main>

        {/* Game Over Screen */}
        {gameover && (
          <div className="gameover-overlay">
            <div className="gameover-modal">
              <h2>Game Over!</h2>
              <p className="final-score">Final Score: {score}</p>
              <p className="high-score">Highest Score: {highScore}</p>
              <div className="gameover-buttons">
                <button className="try-again-btn" onClick={startGame}>
                  Try Again?
                </button>
                <a
                  href={`https://wa.me/?text=My%20highest%20score%20%3D%20${highScore}%20in%20the%20Christmas%20Nerf%20game!%20%F0%9F%8E%84`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="share-btn"
                >
                  Share on WhatsApp
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Start Screen */}
        {!gameActive && !gameover && (
          <div className="start-overlay">
            <div className="start-modal">
              <h2>Ready to Play?</h2>
              <div className="instructions">
                <p>🎯 <strong>Hit the Grinch</strong> to earn points!</p>
                <p>⚠️ <strong>Be careful not to hit Santa</strong> or you'll lose points!</p>
                <p>⏱️ You have <strong>60 seconds</strong></p>
              </div>
              <button className="start-btn" onClick={startGame}>
                Start Game
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
