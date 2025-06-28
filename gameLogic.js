import { currentRound, currentScore, currentPlayer, currentDiceRoll, currentSongRepetitionsLeft, currentMaxPointsForSong, isPlayerReady, player, currentPlayingTrack, isResolvingSong, currentPlaylistTracks, currentPlayStartPosition, setCurrentRound, setCurrentScore, setCurrentPlayer, setCurrentDiceRoll, setCurrentSongRepetitionsLeft, setCurrentMaxPointsForSong, setIsResolvingSong, setCurrentPlayingTrack, setIntroAnimationPlayed, currentGameState, setCurrentGameState } from './gameState.js';
import { MAX_ROUNDS_PER_PLAYER, TOTAL_GAME_ROUNDS, DICE_PARAMETERS } from './constants.js';
import { playSongBasedOnDice, selectRandomSongForRound } from './spotifyPlayer.js';
import { showDice, hideDice, showLogoButton, showResolutionButtons, updateScoreDisplay, updateRoundDisplay, hideResolutionButtons, setLogoAsPlayButton, showInitialClickBlocker, hideInitialClickBlocker } from './uiManager.js';
import { logo, diceAnimation, diceButtons, spotifyLoginButton } from './domElements.js';

/**
 * Wechselt den aktiven Spieler von 1 zu 2 oder umgekehrt.
 * Aktualisiert anschließend den Hintergrund und startet die nächste Phase.
 */
export function switchPlayer() {
    setActivePlayer((activePlayer === 1) ? 2 : 1);
    console.log(`Spieler gewechselt. Aktiver Spieler: ${activePlayer}`);
    setCurrentRound(currentRound + 1); // Runde erhöhen
    console.log(`Starte Runde ${Math.ceil(currentRound / 2)} für Spieler ${activePlayer}`);

    if (currentRound >= TOTAL_GAME_ROUNDS) {
        // Wenn max. Runden erreicht, direkt Spiel beenden
        endGame();
    } else {
        // Hier rufen wir updatePlayerBackground mit einem Callback auf
        // Die Würfelphase startet erst NACHDEM der Hintergrund gewechselt ist
        updatePlayerBackground(() => {
            startDiceRollPhase(); // Startet die Würfelphase nach dem Hintergrundübergang
        });
    }
}

/**
 * Startet die Würfel-Phase: Zeigt die Würfel-Animation an und danach die Auswahl-Buttons.
 */
export function startDiceRollPhase() {
    console.log(`startDiceRollPhase: Spieler ${activePlayer} würfelt.`);
    hideAllGameUI(); // Stellt sicher, dass alles andere ausgeblendet ist

    // Logo-Button inaktiv machen
    setLogoAsPlayButton(false);

    playbackStatus.textContent = `Spieler ${activePlayer} würfelt...`;

    // Würfel-Container einblenden und Animation starten
    diceContainer.classList.remove('hidden');
    diceAnimation.classList.remove('hidden'); // GIF anzeigen
    diceButtonsContainer.classList.add('hidden'); // Buttons noch verstecken

    // Die Dauer der GIF-Animation anpassen (hier 2 Sekunden)
    const animationDurationMs = 2000; // Aus Konstanten übernehmen

    setTimeout(() => {
        console.log("Würfel-Animation beendet. Zeige Würfelwahl-Buttons.");
        diceAnimation.classList.add('hidden'); // GIF ausblenden
        diceButtonsContainer.classList.remove('hidden'); // Buttons einblenden
        playbackStatus.textContent = 'Wähle deinen Würfelwert!';
        setCurrentGameState('diceSelect'); // Neuer Zustand: Warten auf Würfelwahl

        // Event-Listener für die Würfel-Buttons hinzufügen
        diceButtons.forEach(button => {
            button.addEventListener('pointerup', handleDiceSelection, { once: true }); // { once: true } sorgt dafür, dass der Listener nach einmaliger Ausführung entfernt wird
        });

    }, animationDurationMs);
}

/**
 * Behandelt die Auswahl eines Würfel-Buttons durch den Spieler.
 * @param {Event} event - Das Klick-Event des Buttons.
 */
export function handleDiceSelection(event) {
    event.preventDefault();

    if (currentGameState !== 'diceSelect') {
        console.warn("handleDiceSelection: Nicht im 'diceSelect' Zustand, ignoriere Klick.");
        return;
    }

    const clickedButton = event.currentTarget;

    // Optional: Entferne alle anderen Listener VOR dem Bounce, um Mehrfachklicks während der Animation zu vermeiden.
    diceButtons.forEach(button => {
        button.removeEventListener('pointerup', handleDiceSelection);
        button.classList.add('inactive-dice-button'); // Optional: Macht Buttons inaktiv während des Bounces
    });

    // --- Bounce-Effekt für den geklickten Würfel-Button ---
    clickedButton.classList.remove('logo-bounce');
    void clickedButton.offsetWidth; // Erzwingt Reflow
    clickedButton.classList.add('logo-bounce');
    // --- ENDE BOUNCE-EFFEKT ---

    // Verzögere die Ausführung der eigentlichen Aktion, bis der Bounce beendet ist
    const bounceDurationMs = 200; // Aus Konstanten übernehmen

    setTimeout(() => {
        const selectedDiceValue = parseInt(clickedButton.dataset.diceValue, 10);
        setCurrentDiceRoll(selectedDiceValue);
        setCurrentMaxPointsForSong(DICE_PARAMETERS[selectedDiceValue].maxPoints);
        setCurrentSongRepetitionsLeft(DICE_PARAMETERS[selectedDiceValue].repetitions);

        console.log(`Würfel ${selectedDiceValue} gewählt. Max Punkte: ${currentMaxPointsForSong}, Wiederholungen: ${currentSongRepetitionsLeft}`);

        // Würfel-UI ausblenden
        diceContainer.classList.add('hidden');
        diceAnimation.classList.add('hidden');
        diceButtonsContainer.classList.add('hidden');

        // Optional: Entferne die Inaktivitätsklasse von allen Buttons, falls hinzugefügt
        diceButtons.forEach(button => {
            button.classList.remove('inactive-dice-button');
        });

        // Weiter zur Genre-Auswahlphase
        startGenreSelectionPhase();

    }, bounceDurationMs); // Warte, bis der Bounce vorbei ist
}

/**
 * Platzhalter für die Genre-Auswahlphase (noch zu implementieren)
 */
export function startGenreSelectionPhase() {
    setCurrentGameState('genreSelect');
    playbackStatus.textContent = `Wähle ein Genre für Spieler ${activePlayer}!`;
    console.log("Platzhalter: Starte Genre-Auswahlphase.");
    // Hier würde die UI für die Genre-Auswahl erscheinen
    // Für jetzt simulieren wir einfach einen direkten Übergang zum Song-Abspielen
    setTimeout(() => {
        console.log("Simuliere Genre-Auswahl. Bereite Song für Wiedergabe vor.");
        playbackStatus.textContent = 'Klicke auf das Logo zum Abspielen des Songs!';
        setCurrentGameState('playing'); // Song ist bereit zum Abspielen
        setLogoAsPlayButton(true); // Logo wird wieder zum Play-Button
    }, 3000);
}

/**
 * Startet die Auflösungsphase, in der der Songtitel und Interpret angezeigt werden.
 */
export async function startResolutionPhase() {
    if (isResolvingSong) return; // Verhindert mehrfaches Aufrufen
    setIsResolvingSong(true);
    setCurrentGameState('resolutionPhase');
    setLogoAsPlayButton(false); // Logo inaktiv, da jetzt Auflösung stattfindet
    console.log("Starte Auflösungsphase. Zeige Titel/Interpret und Richtig/Falsch-Buttons.");

    playbackStatus.textContent = `Auflösung: ${currentPlayingTrack.track.name} von ${currentPlayingTrack.track.artists.map(a => a.name).join(', ')}`;

    // Optional: Song auf halber Lautstärke abspielen lassen ab Sekunde 30
    if (player && currentPlayingTrack.track.duration_ms > 30000) {
        await player.setVolume(0.25); // Halbe Lautstärke für Auflösung
        await player.seek(30000); // Springt zu 30 Sekunden
        await player.resume();
        console.log("Song spielt auf halber Lautstärke ab Sekunde 30.");
    } else if (player) { // Wenn der Song kürzer ist, einfach ab Beginn spielen
        await player.setVolume(0.25);
        await player.seek(0);
        await player.resume();
        console.log("Song spielt auf halber Lautstärke ab Beginn.");
    }

    // Hier würden die "Richtig" und "Falsch" Buttons erscheinen
    // und ihre Klicks würden dann z.B. eine Funktion handleGuess(isCorrect) aufrufen.
    // Für jetzt simulieren wir einfach einen direkten Übergang
    setTimeout(() => {
        console.log("Simuliere Richtig-Klick.");
        handleGuess(true); // Simuliere einen richtigen Tipp
    }, 5000); // 5 Sekunden für die Auflösung/Bewertung
}

/**
 * Behandelt die Logik, nachdem der Spieler geraten oder die Zeit abgelaufen ist.
 * Aktualisiert Punkte und wechselt den Spieler/beendet das Spiel.
 * @param {boolean} isCorrect - True, wenn der Spieler richtig geraten hat, False sonst.
 */
export async function handleGuess(isCorrect) {
    console.log(`Spieler ${activePlayer} hat ${isCorrect ? 'richtig' : 'falsch'} geraten.`);
    setIsResolvingSong(false); // Auflösungsphase beendet

    if (player) {
        await player.pause(); // Song stoppen
        await player.setVolume(0.5); // Lautstärke zurücksetzen
    }

    if (isCorrect) {
        setPlayerScores({ ...playerScores, [activePlayer]: playerScores[activePlayer] + currentMaxPointsForSong });
        playbackStatus.textContent = `Richtig!`; // Nur "Richtig!" anzeigen
    } else {
        playbackStatus.textContent = `Falsch!`; // Nur "Falsch!" anzeigen
    }

    // UI-Elemente zurücksetzen/ausblenden, die zur Ratephase gehören
    // z.B. hideResolveButton(), hideGuessButtons() (noch zu implementieren)

    updatePlayerScoresDisplay(); // Aktualisiert die Punkteanzeige (muss existieren)

    setCurrentPlayingTrack(null); // Für die nächste Runde zurücksetzen
    setCurrentDiceRoll(null); // Würfel zurücksetzen
    setCurrentMaxPointsForSong(0); // Punkte zurücksetzen
    setCurrentSongRepetitionsLeft(0); // Wiederholungen zurücksetzen

    // Warte eine kurze Zeit, bevor das Spiel zum nächsten Spieler wechselt oder endet
    setTimeout(() => {
        // Prüfe hier zusätzlich, ob das Spiel beendet ist.
        if (currentRound >= TOTAL_GAME_ROUNDS || playerScores[1] >= 50 || playerScores[2] >= 50) { // Beispiel: Spielende bei 50 Punkten
            endGame();
        } else {
            switchPlayer(); // Nächsten Spieler dran
        }
    }, 2000); // 2 Sekunden warten, bevor der Spieler wechselt/Spiel endet
}

/**
 * Funktion für das Spielende.
 */
export function endGame() {
    console.log("Spiel beendet! Zeige Auswertungsscreen.");
    setCurrentGameState('gameEnded');

    // HIER WIRD DER SCORE-SCREEN-BG HINZUGEFÜGT!
    gameContainer.classList.remove('player1-active-bg', 'player2-active-bg'); // Sicherstellen, dass andere BGs weg sind
    gameContainer.classList.add('score-screen-bg');
    console.log("Hintergrund auf Score-Screen für Spielende gesetzt.");

    // HIER DIE LOGIK FÜR DEN AUSWERTUNGSSCREEN MIT PUNKTEN
    playbackStatus.textContent = `Spiel beendet! Spieler 1: ${playerScores[1]} Punkte, Spieler 2: ${playerScores[2]} Punkte.`;

    // Reset game state for new game
    setTimeout(() => {
        resetGame(); // Spiel zurücksetzen
    }, 7000); // 7 Sekunden Auswertungsscreen
}

/**
 * Funktion zum Zurücksetzen des Spiels auf den Anfangszustand.
 */
export function resetGame() {
    console.log("Spiel wird zurückgesetzt.");
    setActivePlayer(1);
    setPlayerScores({ 1: 0, 2: 0 });
    setCurrentRound(0); // Wichtig: Runden zählen, um endGame zu triggern
    setCurrentDiceRoll(null);
    setCurrentPlayingTrack(null);
    setIntroAnimationPlayed(false); // Animation wieder erlauben
    setIsResolvingSong(false);

    // UI auf Startzustand zurücksetzen
    showLoginScreen(); // Oder direkt zum Logo, wenn schon eingeloggt
    // Entferne ALLE Spieler-Hintergrund-Klassen UND den Score-Screen-Hintergrund beim Reset
    gameContainer.classList.remove('player1-active-bg', 'player2-active-bg', 'score-screen-bg');
    gameContainer.style.backgroundColor = 'black'; // Setze den Hintergrund auf schwarz zurück
    console.log("Spielhintergrund auf Schwarz zurückgesetzt (nach Reset).");

    // Diese Logik gehört eigentlich in main.js
    // Da wir aber eine saubere Trennung anstreben und checkOrientationAndFullscreen
    // global im Main-Modul verfügbar ist, können wir es direkt importieren und aufrufen.
    checkOrientationAndFullscreen();
}
