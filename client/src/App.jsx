import { useEffect, useRef, useState } from "react";

import useSocket from "./hooks/useSocket";

import "./App.css";

function App() {

  const { socket, connected } = useSocket();

  const [playerName, setPlayerName] = useState("");

  const [roomCode, setRoomCode] = useState("");

  const [currentRoom, setCurrentRoom] = useState("");

  const [players, setPlayers] = useState([]);

  const [ticket, setTicket] = useState(null);

  const [markedNumbers, setMarkedNumbers] = useState([]);

  const [calledNumbers, setCalledNumbers] = useState([]);

  const [gameStarted, setGameStarted] = useState(false);

  const [message, setMessage] = useState("");

  const [currentNumber, setCurrentNumber] = useState(null);

  const [voiceEnabled, setVoiceEnabled] = useState(false);

  const [callerPaused, setCallerPaused] = useState(false);
  const [callInterval, setCallInterval] = useState(10);
  const [showHostSettings, setShowHostSettings] = useState(false);

  const [allNumbersCalled, setAllNumbersCalled] = useState(false);
  const [gameResults, setGameResults] = useState(null);

  const [prizePopup, setPrizePopup] = useState(null);

  const prizeTimeoutRef = useRef(null);

  const numberTimeoutRef = useRef(null);

  const me = players.find((player) => player.id === socket?.id);

  const isHost = Boolean(me?.isHost);

  const sessionIdRef = useRef(null);

  if (!sessionIdRef.current) {
    let savedId = null;
    try { savedId = window.localStorage.getItem("tambola-session-id"); } catch {}
    if (!savedId) {
      savedId = window.crypto?.randomUUID?.() || `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      try { window.localStorage.setItem("tambola-session-id", savedId); } catch {}
    }
    sessionIdRef.current = savedId;
  }

  useEffect(() => {

    if (!socket) return;

    const clearNumberTimeout = () => {

      if (numberTimeoutRef.current) {

        clearTimeout(numberTimeoutRef.current);

        numberTimeoutRef.current = null;

      }

    };

    const onMarkedNumbersUpdated = ({ markedNumbers }) => {

      setMarkedNumbers(markedNumbers);

      setMessage("");

    };

    const onPrizeWon = (prize) => {

      setPrizePopup(prize);

      if (prizeTimeoutRef.current) {

        clearTimeout(prizeTimeoutRef.current);

      }

      prizeTimeoutRef.current = setTimeout(() => {

        setPrizePopup(null);

        prizeTimeoutRef.current = null;

      }, 5000);

    };

    const onGameFinished = (results) => {
      clearNumberTimeout();
      setCurrentNumber(null);
      setAllNumbersCalled(results.reason === "all-numbers-called");
      setGameResults(results);
      setCallerPaused(true);
      setMessage("Game over! Final results are ready.");
    };

    const onRoomCreated = ({ roomCode, players }) => {

      clearNumberTimeout();

      setCurrentRoom(roomCode);

      setRoomCode(roomCode);

      setPlayers(players);

      setTicket(null);

      setMarkedNumbers([]);

      setCalledNumbers([]);

      setCurrentNumber(null);

      setGameStarted(false);

      setCallerPaused(false);

      setAllNumbersCalled(false);
      setPrizePopup(null);
      setGameResults(null);

      setMessage("Room created! Share the code with your friends.");

    };

    const onRoomJoined = ({ roomCode }) => {

      setCurrentRoom(roomCode);

      setMessage("You joined the lobby!");

    };

    const onPlayersUpdated = ({ players }) => {

      setPlayers(players);

    };

    const onRoomError = (error) => {

      setMessage(error);

    };

    const onRoomLeft = ({ message } = {}) => {
      clearNumberTimeout();
      setCurrentRoom("");
      setRoomCode("");
      setPlayers([]);
      setTicket(null);
      setMarkedNumbers([]);
      setCalledNumbers([]);
      setCurrentNumber(null);
      setGameStarted(false);
      setCallerPaused(false);
      setAllNumbersCalled(false);
      setShowHostSettings(false);
      setPrizePopup(null);
      setGameResults(null);
      setMessage(message || "You returned to the home screen.");
    };
const onYourTicket = ({ ticket }) => {

      setTicket(ticket);

      setMarkedNumbers([]);

    };

    const onGameStarted = () => {

      clearNumberTimeout();

      setGameStarted(true);

      setMarkedNumbers([]);

      setCalledNumbers([]);

      setCurrentNumber(null);

      setCallerPaused(false);

      setAllNumbersCalled(false);
      setPrizePopup(null);
      setGameResults(null);

      setMessage("Game started! Good luck!");

    };

    const onNumberCalled = ({ number }) => {

      setCurrentNumber(number);

      setAllNumbersCalled(false);

      // Remember called numbers internally, not as visible history.

      setCalledNumbers((previous) =>

        previous.includes(number)

          ? previous

          : [...previous, number]

      );

      clearNumberTimeout();

      // Hide the displayed number after 10 seconds.

      numberTimeoutRef.current = setTimeout(() => {

        setCurrentNumber(null);

        numberTimeoutRef.current = null;

      }, 10000);

      // Voice is optional and controlled separately by each player.

      if (voiceEnabled && "speechSynthesis" in window) {

        window.speechSynthesis.cancel();

        const announcement = new SpeechSynthesisUtterance(

          `Number ${number}`

        );

        window.speechSynthesis.speak(announcement);

      }

    };

    const onCallerStatus = ({ paused }) => {

      setCallerPaused(paused);

    };

    const onAllNumbersCalled = () => {

      clearNumberTimeout();

      setCurrentNumber(null);

      setAllNumbersCalled(true);

      setMessage("All 90 numbers have been called!");

    };

    const onSessionRestored = ({ roomCode, players, ticket, markedNumbers, calledNumbers, currentNumber, started, paused, allNumbersCalled, callInterval, gameResults }) => {
      setCurrentRoom(roomCode);
      setRoomCode(roomCode);
      setPlayers(players || []);
      setTicket(ticket || null);
      setMarkedNumbers(markedNumbers || []);
      setCalledNumbers(calledNumbers || []);
      setCurrentNumber(currentNumber ?? null);
      setGameStarted(Boolean(started));
      setCallerPaused(Boolean(paused));
      setAllNumbersCalled(Boolean(allNumbersCalled));
      setCallInterval(callInterval || 10);
      setGameResults(gameResults || null);
      setMessage("Reconnected! Your game has been restored.");
    };

    const onPlayerKicked = () => {
      setCurrentRoom("");
      setRoomCode("");
      setPlayers([]);
      setTicket(null);
      setMarkedNumbers([]);
      setCalledNumbers([]);
      setGameStarted(false);
      setCurrentNumber(null);
      setGameResults(null);
      setMessage("The host removed you from the room.");
    };

    const onRoomSettings = ({ callInterval }) => setCallInterval(callInterval || 10);

    const tryRestoreSession = () => {
      socket.emit("restore-session", { sessionId: sessionIdRef.current });
    };
    socket.on("connect", tryRestoreSession);
    if (socket.connected) tryRestoreSession();
    socket.on("session-restored", onSessionRestored);
    socket.on("player-kicked", onPlayerKicked);
    socket.on("room-settings", onRoomSettings);

    socket.on("room-created", onRoomCreated);

    socket.on("room-joined", onRoomJoined);

    socket.on("players-updated", onPlayersUpdated);

    socket.on("room-error", onRoomError);
    socket.on("room-left", onRoomLeft);
    socket.on("marked-numbers-updated", onMarkedNumbersUpdated);
    socket.on("prize-won", onPrizeWon);

    socket.on("your-ticket", onYourTicket);

    socket.on("game-started", onGameStarted);

    socket.on("number-called", onNumberCalled);

    socket.on("caller-status", onCallerStatus);

    socket.on("all-numbers-called", onAllNumbersCalled);
    socket.on("game-finished", onGameFinished);

    return () => {

      clearNumberTimeout();

      socket.off("connect", tryRestoreSession);
      socket.off("session-restored", onSessionRestored);
      socket.off("player-kicked", onPlayerKicked);
      socket.off("room-settings", onRoomSettings);
      socket.off("room-created", onRoomCreated);

      socket.off("room-joined", onRoomJoined);

      socket.off("players-updated", onPlayersUpdated);

      socket.off("room-error", onRoomError);
      socket.off("room-left", onRoomLeft);
      socket.off("marked-numbers-updated", onMarkedNumbersUpdated);
      socket.off("prize-won", onPrizeWon);

      socket.off("your-ticket", onYourTicket);

      socket.off("game-started", onGameStarted);

      socket.off("number-called", onNumberCalled);

      socket.off("caller-status", onCallerStatus);

      socket.off("all-numbers-called", onAllNumbersCalled);
      socket.off("game-finished", onGameFinished);

    };

  }, [socket, voiceEnabled]);

  useEffect(() => {

    return () => {

      if (numberTimeoutRef.current) {

        clearTimeout(numberTimeoutRef.current);

      }

      if (prizeTimeoutRef.current) {
        clearTimeout(prizeTimeoutRef.current);
      }

      if ("speechSynthesis" in window) {

        window.speechSynthesis.cancel();

      }

    };

  }, []);

  function createRoom() {

    if (!playerName.trim()) {

      setMessage("Enter your player name first.");

      return;

    }

    setMessage("");

    socket.emit("create-room", { playerName, sessionId: sessionIdRef.current });

  }

  function joinRoom() {

    if (!playerName.trim() || !roomCode.trim()) {

      setMessage("Enter your name and room code.");

      return;

    }

    setMessage("");

    socket.emit("join-room", { playerName, roomCode, sessionId: sessionIdRef.current });

  }

  function startGame() {

    setMessage("");

    socket.emit("start-game");

  }

  function toggleVoice() {

    if (voiceEnabled && "speechSynthesis" in window) {

      window.speechSynthesis.cancel();

    }

    setVoiceEnabled((previous) => !previous);

  }

  function toggleCaller() {

    setMessage("");

    socket.emit(

      callerPaused ? "resume-caller" : "pause-caller"

    );

  }

  function changeCallInterval(value) {
    const seconds = Number(value);
    setCallInterval(seconds);
    socket.emit("set-call-interval", { seconds });
  }

  function kickPlayer(playerId, playerName) {
    if (!window.confirm(`Remove ${playerName} from this room?`)) return;
    socket.emit("kick-player", { playerId });
  }

  function leaveRoom() {
    const confirmed = window.confirm("Return to the home screen and leave this room?");
    if (!confirmed) return;
    setMessage("");
    socket.emit("leave-room");
  }

  // Ask the server to validate and record the manual mark.
  function toggleMarkNumber(number) {
    if (number == null || !socket) return;

    setMessage("");
    socket.emit("mark-number", { number });
  }

  function copyRoomCode() {

    navigator.clipboard

      .writeText(currentRoom)

      .then(() => setMessage("Room code copied!"))

      .catch(() => setMessage(`Share this room code: ${currentRoom}`));

  }

  return (

    <main className="app">

      <header className="topbar">

        <div className="brand">🎟️ Tambola Madness</div>

        <div className="status">

          <span className={connected ? "dot online" : "dot"} />

          {connected ? "Connected" : "Connecting..."}

        </div>

      </header>

      {prizePopup && (
        <div className="prize-popup" role="status" aria-live="polite">
          <div className="prize-popup-icon">🏆</div>
          <div className="prize-popup-content">
            {prizePopup.prize === "First Number" ? (
              <strong>{prizePopup.winner} got their first number!</strong>
            ) : (
              <>
                <strong>{prizePopup.winner} won {prizePopup.prize}!</strong>
                <span>
                  {prizePopup.points > 0
                    ? `+${prizePopup.points} points`
                    : "Prize announced"}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      <section className="hero">

        {!currentRoom ? (

          <>

            <p className="eyebrow">YOUR FRIEND GROUP. YOUR RULES.</p>

            <h1>

              Bingo night,

              <br />

              <span>gone wild.</span>

            </h1>

            <p className="subtitle">

              Create a room, invite your friends, and let the madness begin.

            </p>

            <input

              className="field"

              placeholder="Enter your player name"

              value={playerName}

              onChange={(event) => setPlayerName(event.target.value)}

              maxLength={20}

            />

            <div className="actions">

              <button

                className="primary"

                onClick={createRoom}

                disabled={!connected}

              >

                ✨ Create Room

              </button>

              <div className="join">

                <input

                  className="field"

                  placeholder="Room code"

                  value={roomCode}

                  onChange={(event) =>

                    setRoomCode(event.target.value.toUpperCase())

                  }

                  maxLength={6}

                />

                <button

                  className="secondary"

                  onClick={joinRoom}

                  disabled={!connected}

                >

                  Join Room

                </button>

              </div>

            </div>

          </>

        ) : (

          <div className="room-panel">

            {!gameStarted ? (

              <>

                <p className="eyebrow">ROOM LOBBY</p>

                <h1>

                  Waiting for

                  <br />

                  <span>your crew.</span>

                </h1>

                <p className="subtitle">

                  Share the code to invite your friends.

                </p>

                <div className="room-code">

                  <span>ROOM CODE</span>

                  <strong>{currentRoom}</strong>

                  <button className="secondary" onClick={copyRoomCode}>

                    Copy Code

                  </button>

                </div>

                <h3>Players ({players.length}/8)</h3>

                <div className="player-list">

                  {players.map((player) => (

                    <div className="player-row" key={player.id}>

                      <span>{player.name}</span>

                      <span className="player-row-actions">
                        {player.isHost ? "👑 Host" : "🎟️ Player"}
                        {isHost && !player.isHost && (
                          <button className="kick-button" onClick={() => kickPlayer(player.id, player.name)} aria-label={`Kick ${player.name}`}>Kick</button>
                        )}
                      </span>

                    </div>

                  ))}

                </div>

                {isHost && (
                  <section className="host-settings">
                    <button type="button" className="secondary settings-toggle" onClick={() => setShowHostSettings((value) => !value)}>
                      ⚙️ Host Settings {showHostSettings ? "▲" : "▼"}
                    </button>
                    {showHostSettings && (
                      <div className="settings-content">
                        <label htmlFor="call-speed-lobby">Call a number every</label>
                        <select id="call-speed-lobby" value={callInterval} onChange={(event) => changeCallInterval(event.target.value)}>
                          <option value={3}>3 seconds (Fast)</option>
                          <option value={5}>5 seconds</option>
                          <option value={10}>10 seconds (Default)</option>
                          <option value={15}>15 seconds</option>
                          <option value={20}>20 seconds (Slow)</option>
                        </select>
                      </div>
                    )}
                  </section>
                )}

                <button type="button" className="secondary home-button" onClick={leaveRoom}>← Back to Home</button>

                {isHost ? (

                  <button

                    className="primary start-button"

                    onClick={startGame}

                    disabled={players.length < 2}

                  >

                    🎲 Start Game

                  </button>

                ) : (

                  <p className="hint">

                    Waiting for the host to start the game...

                  </p>

                )}

                {isHost && players.length < 2 && (

                  <p className="hint">

                    At least 2 players are needed to start.

                  </p>

                )}

              </>

            ) : (

              <>

                <p className="eyebrow">GAME IN PROGRESS</p>

                <h1>

                  Your <span>ticket.</span>

                </h1>

                <div className="game-layout">

                  <section className="ticket-section">

                    {ticket ? (

                      <div className="ticket">

                        <div className="ticket-grid">

                          {ticket.map((row, rowIndex) =>

                            row.map((number, colIndex) => (

                              <div

                                className={`ticket-cell ${

                                  number == null

                                    ? "empty"

                                    : markedNumbers.includes(number)

                                      ? "number marked"

                                      : "number"

                                }`}

                                key={`${rowIndex}-${colIndex}`}

                                onClick={() => toggleMarkNumber(number)}

                                role={number != null ? "button" : undefined}

                                tabIndex={number != null ? 0 : undefined}

                                aria-label={

                                  number == null

                                    ? "Empty ticket cell"

                                    : `Number ${number}${

                                        markedNumbers.includes(number)

                                          ? ", marked"

                                          : ""

                                      }`

                                }

                                aria-pressed={

                                  number != null &&

                                  markedNumbers.includes(number)

                                }

                                onKeyDown={(event) => {

                                  if (

                                    number != null &&

                                    (event.key === "Enter" ||

                                      event.key === " ")

                                  ) {

                                    event.preventDefault();

                                    toggleMarkNumber(number);

                                  }

                                }}

                              >

                                {number ?? ""}

                              </div>

                            ))

                          )}

                        </div>

                      </div>

                    ) : (

                      <p className="subtitle">Preparing your ticket...</p>

                    )}

                    <p className="hint">

                      Tap a number on your ticket to mark it after it has

                      been called.

                    </p>

                  </section>

                  <aside className="number-panel">

                    <p className="eyebrow">CURRENT NUMBER</p>

                    <div

                      className={`current-number ${

                        currentNumber == null ? "number-hidden" : ""

                      }`}

                    >

                      {allNumbersCalled

                        ? "DONE"

                        : currentNumber ?? "--"}

                    </div>

                    <p className="number-caption">

                      {allNumbersCalled

                        ? "All 90 numbers called!"

                        : currentNumber == null

                          ? "Waiting for number..."

                          : "Find it on your ticket!"}

                    </p>

                    <button

                      className="secondary caller-button"

                      onClick={toggleVoice}

                    >

                      {voiceEnabled ? "🔊 Voice On" : "🔇 Voice Off"}

                    </button>

                    {isHost && !allNumbersCalled && (

                      <button

                        className="primary caller-button"

                        onClick={toggleCaller}

                      >

                        {callerPaused

                          ? "▶ Resume Calling"

                          : "⏸ Pause Calling"}

                      </button>

                    )}

                    {callerPaused && (

                      <p className="pause-label">Calling is paused</p>

                    )}

                    {!isHost && (

                      <p className="hint">

                        The host controls number calling.

                      </p>

                    )}

                  </aside>

                </div>

                {isHost && (
                  <section className="host-settings game-host-settings">
                    <button type="button" className="secondary settings-toggle" onClick={() => setShowHostSettings((value) => !value)}>
                      ⚙️ Host Settings {showHostSettings ? "▲" : "▼"}
                    </button>
                    {showHostSettings && (
                      <div className="settings-content">
                        <label htmlFor="call-speed-game">Call a number every</label>
                        <select id="call-speed-game" value={callInterval} onChange={(event) => changeCallInterval(event.target.value)}>
                          <option value={3}>3 seconds (Fast)</option>
                          <option value={5}>5 seconds</option>
                          <option value={10}>10 seconds (Default)</option>
                          <option value={15}>15 seconds</option>
                          <option value={20}>20 seconds (Slow)</option>
                        </select>
                        <h4>Manage players</h4>
                        {players.filter((player) => !player.isHost).map((player) => (
                          <div className="player-row" key={player.id}>
                            <span>{player.name}</span>
                            <button className="kick-button" onClick={() => kickPlayer(player.id, player.name)}>Kick</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}
                <button type="button" className="secondary home-button" onClick={leaveRoom}>← Leave Room & Go Home</button>
                <p className="hint">Room: {currentRoom}</p>

              </>

            )}

          </div>

        )}

        {gameResults && (
          <div className="results-backdrop" role="dialog" aria-modal="true" aria-labelledby="results-title">
            <section className="results-card">
              <p className="eyebrow">TAMBOLA MADNESS</p>
              <h2 id="results-title">🏆 Game Results</h2>
              <p className="results-summary">
                {gameResults.reason === "all-prizes-awarded"
                  ? "All prizes have been awarded!"
                  : "All 90 numbers have been called!"}
                {` ${gameResults.calledCount ?? calledNumbers.length} numbers called.`}
              </p>
              <h3>Final leaderboard</h3>
              <ol className="results-leaderboard">
                {(gameResults.leaderboard || players).map((player, index) => (
                  <li key={player.id || player.name}>
                    <span>{index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🎟️"} {player.name}{player.isHost ? " 👑" : ""}</span>
                    <strong>{player.score ?? 0} pts</strong>
                  </li>
                ))}
              </ol>
              <h3>Prize winners</h3>
              {gameResults.prizes?.length ? (
                <ul className="results-prizes">
                  {gameResults.prizes.map((prize, index) => (
                    <li key={`${prize.prize}-${index}`}>
                      <span><strong>{prize.prize}</strong> — {prize.winner}</span>
                      <span>{prize.points > 0 ? `+${prize.points} pts` : "No points"}</span>
                    </li>
                  ))}
                </ul>
              ) : <p>No prizes were awarded.</p>}
              <button type="button" className="primary results-home-button" onClick={leaveRoom}>← Leave Room & Go Home</button>
            </section>
          </div>
        )}

        {message && (

          <p role="status" className="message">

            {message}

          </p>

        )}

        {!currentRoom && (

          <p className="hint">

            2–8 players · Real-time play · Maximum madness

          </p>

        )}

      </section>

    </main>

  );

}

export default App;
