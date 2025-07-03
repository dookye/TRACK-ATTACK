
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GamePhase, GameState, Player, RoundData, SpotifyPlayer, SpotifyTrack } from './types';
import { getAccessToken, redirectToAuthCodeFlow, initSpotifyPlayer, fetchRandomTrack, playTrackSnippet } from './services/spotifyService';
import { GameLogo, SpotifyIcon, DiceIcon } from './components/Icons';
import { TOTAL_ROUNDS_PER_PLAYER, PLAYER_COLORS, GENRES, GenreName } from './constants';

const initialGameState: GameState = {
  phase: GamePhase.LOGIN,
  currentPlayer: 1,
  player1Score: 0,
  player2Score: 0,
  totalRound: 1,
  roundData: null,
};

const App: React.FC = () => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [player, setPlayer] = useState<SpotifyPlayer | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [gameState, setGameState] = useState<GameState>(initialGameState);

  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  const handleOrientationChange = useCallback(() => {
    setIsLandscape(window.innerWidth > window.innerHeight);
  }, []);

  const handleFullscreenChange = useCallback(() => {
    setIsFullscreen(!!document.fullscreenElement);
  }, []);

  const requestFullscreen = useCallback(() => {
    document.documentElement.requestFullscreen().catch(err => {
      console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
    });
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleOrientationChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    handleOrientationChange(); // Initial check

    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [handleOrientationChange, handleFullscreenChange]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      window.history.pushState({}, '', window.location.pathname); // Clean URL
      getAccessToken(code).then(setAccessToken).catch(console.error);
    }
  }, []);

  useEffect(() => {
    if (accessToken && !player) {
      initSpotifyPlayer(accessToken).then(p => {
        p.addListener('ready', ({ device_id }) => {
          console.log('Spotify Player is ready with Device ID', device_id);
          setDeviceId(device_id);
          setIsPlayerReady(true);
        });
        p.addListener('not_ready', ({ device_id }) => {
          console.log('Device ID has gone offline', device_id);
          setIsPlayerReady(false);
        });
        p.addListener('initialization_error', ({ message }) => console.error(message));
        p.addListener('authentication_error', ({ message }) => {
          console.error(message);
          setAccessToken(null); // Force re-login
        });
        p.addListener('account_error', ({ message }) => alert(`Account Error: ${message}. A Premium account is required.`));
        p.connect();
        setPlayer(p);
      });
    }
  }, [accessToken, player]);

  useEffect(() => {
    if (isPlayerReady && gameState.phase === GamePhase.LOGIN) {
      setGameState(s => ({ ...s, phase: GamePhase.SETUP_ORIENTATION }));
    }
  }, [isPlayerReady, gameState.phase]);


  const startGame = useCallback(() => {
    const hasSeenAnimation = sessionStorage.getItem('hasSeenWelcomeAnimation');
    if (!hasSeenAnimation) {
      setGameState(s => ({ ...s, phase: GamePhase.WELCOME_ANIMATION }));
      setTimeout(() => {
        sessionStorage.setItem('hasSeenWelcomeAnimation', 'true');
        setGameState(s => ({ ...s, phase: GamePhase.IDLE }));
      }, 2000);
    } else {
      setGameState(s => ({ ...s, phase: GamePhase.IDLE }));
    }
  }, []);
  
  useEffect(() => {
     if (gameState.phase === GamePhase.SETUP_FULLSCREEN && isFullscreen) {
        startGame();
     }
  }, [gameState.phase, isFullscreen, startGame])


  const startRound = useCallback(() => {
    setGameState(s => ({ ...s, phase: GamePhase.DICE_ANIMATION }));
    setTimeout(() => {
      setGameState(s => ({ ...s, phase: GamePhase.DICE_SELECTION }));
    }, 4000);
  }, []);

  const selectDice = useCallback((value: number) => {
    const isSpeed = Math.ceil(Math.random() * TOTAL_ROUNDS_PER_PLAYER) === Math.ceil(gameState.totalRound / 2);

    const newRoundData: RoundData = {
      diceValue: value,
      maxAttempts: value,
      playDuration: value === 7 ? 2000 : 7000,
      genre: '',
      track: null,
      attemptsMade: 0,
      isSpeedRound: isSpeed
    };

    setGameState(s => ({ ...s, roundData: newRoundData, phase: GamePhase.GENRE_ANIMATION }));
    setTimeout(() => {
      setGameState(s => ({ ...s, phase: GamePhase.GENRE_SELECTION }));
    }, 4000);
  }, [gameState.totalRound]);

  const selectGenre = useCallback(async (genre: GenreName) => {
    if (!accessToken || !gameState.roundData) return;
    const track = await fetchRandomTrack(accessToken, genre);
    setGameState(s => ({
      ...s,
      roundData: { ...s.roundData!, genre, track },
      phase: s.roundData!.isSpeedRound ? GamePhase.SPEED_ROUND_ANNOUNCEMENT : GamePhase.GUESSING
    }));
  }, [accessToken, gameState.roundData]);

  const playSong = useCallback(() => {
    if (!accessToken || !deviceId || !gameState.roundData?.track) return;
    if (gameState.roundData.attemptsMade < gameState.roundData.maxAttempts) {
      playTrackSnippet(accessToken, deviceId, gameState.roundData.track.uri, gameState.roundData.playDuration);
      setGameState(s => ({
        ...s,
        roundData: { ...s.roundData!, attemptsMade: s.roundData!.attemptsMade + 1 }
      }));
    }
  }, [accessToken, deviceId, gameState]);
  
  const reveal = useCallback(() => {
      setGameState(s => ({...s, phase: GamePhase.REVEAL}))
  }, [])

  const scoreRound = useCallback((correct: boolean) => {
    if (!gameState.roundData) return;
    if (correct) {
      const points = Math.max(1, gameState.roundData.diceValue - (gameState.roundData.attemptsMade - 1));
      if (gameState.currentPlayer === 1) {
        setGameState(s => ({ ...s, player1Score: s.player1Score + points }));
      } else {
        setGameState(s => ({ ...s, player2Score: s.player2Score + points }));
      }
    }
    
    if (gameState.totalRound >= TOTAL_ROUNDS_PER_PLAYER * 2) {
      setGameState(s => ({...s, phase: GamePhase.END_SCREEN}));
      setTimeout(() => {
          setGameState({...initialGameState, phase: GamePhase.IDLE})
      }, 7000)
    } else {
      setGameState(s => ({
        ...s,
        totalRound: s.totalRound + 1,
        currentPlayer: s.currentPlayer === 1 ? 2 : 1,
        phase: GamePhase.PLAYER_SWITCH
      }));
      setTimeout(() => startRound(), 3000);
    }

  }, [gameState, startRound]);
  
  const currentBgColor = useMemo(() => {
    if (gameState.phase === GamePhase.PLAYER_SWITCH || gameState.phase === GamePhase.IDLE || gameState.phase >= GamePhase.DICE_ANIMATION) {
        return PLAYER_COLORS[gameState.currentPlayer].bg;
    }
    return 'bg-black';
  }, [gameState.phase, gameState.currentPlayer]);


  // RENDER LOGIC
  const renderContent = () => {
    if (gameState.phase === GamePhase.LOGIN) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <p className="mb-8 text-xl">Please log in with your Spotify-Premium-Account.</p>
          <button onClick={redirectToAuthCodeFlow} className="flex items-center gap-4 px-8 py-4 bg-[#1DB954] text-white font-bold rounded-full hover:bg-[#1ED760] transition-colors duration-300">
            <SpotifyIcon className="w-8 h-8" />
            <span>LOG IN</span>
          </button>
        </div>
      );
    }
    
    if (!isPlayerReady) {
      return <div className="flex items-center justify-center h-full">Connecting to Spotify...</div>
    }

    if (!isLandscape) {
      return (
        <div className="absolute inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <p className="text-2xl animate-pulse">please rotate your device to landscape mode</p>
        </div>
      );
    }

    if (!isFullscreen && gameState.phase < GamePhase.WELCOME_ANIMATION) {
       if (gameState.phase === GamePhase.SETUP_ORIENTATION || gameState.phase < GamePhase.SETUP_FULLSCREEN) {
          setGameState(s => ({...s, phase: GamePhase.SETUP_FULLSCREEN}));
       }
      return (
        <div onClick={requestFullscreen} className="w-full h-full flex items-center justify-center cursor-pointer">
          <p className="text-4xl animate-pulse">click to Fullscreen</p>
        </div>
      );
    }

    // Main Game Screen
    return <GameScreen
        gameState={gameState}
        setGameState={setGameState}
        onStartRound={startRound}
        onSelectDice={selectDice}
        onSelectGenre={selectGenre}
        onPlaySong={playSong}
        onReveal={reveal}
        onScoreRound={scoreRound}
    />
  };

  return <div className={`w-full h-full transition-colors duration-1000 ${currentBgColor}`}>{renderContent()}</div>;
};


// GameScreen Component
interface GameScreenProps {
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    onStartRound: () => void;
    onSelectDice: (value: number) => void;
    onSelectGenre: (genre: GenreName) => void;
    onPlaySong: () => void;
    onReveal: () => void;
    onScoreRound: (correct: boolean) => void;
}

const GameScreen: React.FC<GameScreenProps> = ({ gameState, setGameState, onStartRound, onSelectDice, onSelectGenre, onPlaySong, onReveal, onScoreRound }) => {
    const { phase, roundData, player1Score, player2Score, currentPlayer } = gameState;
    const [isLogoActive, setIsLogoActive] = useState(true);
    const [showReveal, setShowReveal] = useState(false);
    const [selectedGenre, setSelectedGenre] = useState<GenreName | null>(null);
    const [countdown, setCountdown] = useState(10);

    useEffect(() => {
      if (phase === GamePhase.GUESSING) {
        setIsLogoActive(true);
        setShowReveal(false);
      }
    },[phase]);

    useEffect(() => {
        if (roundData && roundData.attemptsMade > 0) {
            setShowReveal(true);
        }
        if (roundData && roundData.attemptsMade >= roundData.maxAttempts) {
            setIsLogoActive(false);
        }
    }, [roundData]);
    
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (phase === GamePhase.SPEED_ROUND_ANNOUNCEMENT) {
            timer = setTimeout(() => {
                setGameState(s => ({...s, phase: GamePhase.GUESSING}));
            }, 4000);
        }
        return () => clearTimeout(timer);
    }, [phase, setGameState]);

    useEffect(() => {
        let countdownTimer: ReturnType<typeof setTimeout>;
        if(phase === GamePhase.GUESSING && roundData?.isSpeedRound) {
            if(countdown > 0) {
                countdownTimer = setTimeout(() => setCountdown(c => c - 1), 1000);
            } else {
                onReveal();
            }
        }
        return () => clearTimeout(countdownTimer);
    }, [phase, roundData, countdown, onReveal]);


    const renderPhase = () => {
        switch (phase) {
            case GamePhase.WELCOME_ANIMATION:
                return <div className="flex items-center justify-center h-full"><GameLogo className="animate-bounce" /></div>
            
            case GamePhase.IDLE:
                return (
                    <div className="flex items-center justify-center h-full cursor-pointer" onClick={() => { onStartRound(); }}>
                        <GameLogo className="hover:scale-105 transition-transform duration-300" />
                    </div>
                );
            
            case GamePhase.DICE_ANIMATION:
                return <div className="flex items-center justify-center h-full"><p className="text-4xl animate-ping">🎲</p></div>

            case GamePhase.DICE_SELECTION:
                return (
                    <div className="flex flex-col items-center justify-center h-full gap-8">
                        <h2 className="text-3xl font-bold">Player {currentPlayer}, choose your fate!</h2>
                        <div className="flex gap-8">
                            {[3, 4, 5, 7].map(val => (
                                <button key={val} onClick={() => onSelectDice(val)} className="p-2 bg-black bg-opacity-20 rounded-xl hover:scale-110 transition-transform duration-200">
                                  <DiceIcon value={val} />
                                </button>
                            ))}
                        </div>
                    </div>
                );

            case GamePhase.GENRE_ANIMATION:
                 return <div className="flex items-center justify-center h-full"><p className="text-4xl animate-pulse">Choosing genre...</p></div>
            
            case GamePhase.GENRE_SELECTION:
                return <GenreSelection onSelectGenre={onSelectGenre} diceValue={roundData?.diceValue || 3} />;

            case GamePhase.SPEED_ROUND_ANNOUNCEMENT:
                return (
                    <div className="flex items-center justify-center h-full">
                        <h1 className="text-7xl font-black text-white animate-ping">SPEED-ROUND</h1>
                    </div>
                );
            
            case GamePhase.GUESSING:
                return (
                  <div className="flex flex-col items-center justify-center h-full gap-8">
                     {roundData?.isSpeedRound && <div className="absolute top-5 text-8xl font-bold opacity-50">{countdown}</div>}
                     <button onClick={() => { if(isLogoActive) onPlaySong()}} disabled={!isLogoActive} className={`transition-all duration-300 ${!isLogoActive ? 'blur-sm pointer-events-none' : 'cursor-pointer'}`}>
                         <GameLogo />
                     </button>
                     {showReveal && (
                        <button onClick={onReveal} className="px-8 py-3 text-2xl font-bold bg-black bg-opacity-50 border-2 border-white rounded-lg hover:bg-opacity-75 transition-colors">
                           AUFLÖSEN
                        </button>
                     )}
                     <div className="absolute bottom-5 text-xl opacity-70">Attempts left: {(roundData?.maxAttempts || 0) - (roundData?.attemptsMade || 0)}</div>
                  </div>
                )

            case GamePhase.REVEAL:
                if (!roundData?.track) return <div>Loading...</div>;
                return (
                    <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
                        <img src={roundData.track.album.imageUrl} alt={roundData.track.album.name} className="w-48 h-48 rounded-md shadow-2xl" />
                        <div>
                            <h2 className="text-4xl font-bold">{roundData.track.name}</h2>
                            <p className="text-2xl">{roundData.track.artist}</p>
                        </div>
                        <div className="flex gap-6 mt-4">
                            <button onClick={() => onScoreRound(true)} className="px-10 py-4 text-3xl font-bold bg-green-500 rounded-lg hover:bg-green-400 transition-colors">RICHTIG</button>
                            <button onClick={() => onScoreRound(false)} className="px-10 py-4 text-3xl font-bold bg-red-500 rounded-lg hover:bg-red-400 transition-colors">FALSCH</button>
                        </div>
                    </div>
                );
            
            case GamePhase.PLAYER_SWITCH:
                 return <div className="flex items-center justify-center h-full"><h1 className="text-5xl font-bold animate-pulse">Player {currentPlayer}'s Turn!</h1></div>

            case GamePhase.END_SCREEN:
                const winner = player1Score > player2Score ? 1 : player2Score > player1Score ? 2 : 0;
                return (
                    <div className="w-full h-full bg-gradient-to-r from-blue-600 to-pink-600 flex items-center justify-around">
                        <div className={`text-center p-8 ${winner === 1 ? 'animate-bounce' : ''}`}>
                            <h2 className="text-3xl">Player 1</h2>
                            <p className="text-8xl font-black">{player1Score}</p>
                        </div>
                        <div className={`text-center p-8 ${winner === 2 ? 'animate-bounce' : ''}`}>
                             <h2 className="text-3xl">Player 2</h2>
                            <p className="text-8xl font-black">{player2Score}</p>
                        </div>
                    </div>
                )
            
            default:
                return null;
        }
    };
    
    return renderPhase();
};

// GenreSelection sub-component
interface GenreSelectionProps {
    onSelectGenre: (genre: GenreName) => void;
    diceValue: number;
}
const GenreSelection: React.FC<GenreSelectionProps> = ({ onSelectGenre, diceValue }) => {
    const [randomlySelectedGenre, setRandomlySelectedGenre] = useState<GenreName | null>(null);
    const [isAnimating, setIsAnimating] = useState(diceValue !== 7);

    useEffect(() => {
        if (diceValue !== 7) {
            const genres = Object.keys(GENRES) as GenreName[];
            const interval = setInterval(() => {
                setRandomlySelectedGenre(genres[Math.floor(Math.random() * genres.length)]);
            }, 200);

            setTimeout(() => {
                clearInterval(interval);
                setIsAnimating(false);
                 const finalGenre = genres[Math.floor(Math.random() * genres.length)];
                 setRandomlySelectedGenre(finalGenre);
            }, 3800);
            
            return () => clearInterval(interval);
        }
    }, [diceValue]);

    const isChoiceRound = diceValue === 7;

    return (
        <div className="flex flex-col items-center justify-center h-full gap-6">
            <h2 className="text-3xl font-bold">{isChoiceRound ? 'Choose your genre!' : 'Genre will be selected for you!'}</h2>
            <div className="grid grid-cols-2 gap-4">
                {(Object.keys(GENRES) as GenreName[]).map(genre => {
                    const isButtonActive = isChoiceRound || (!isAnimating && genre === randomlySelectedGenre);
                    const isBlinking = isAnimating && genre === randomlySelectedGenre;
                    
                    return (
                        <button 
                            key={genre} 
                            onClick={() => isButtonActive && onSelectGenre(genre)}
                            disabled={!isButtonActive}
                            className={`px-6 py-4 text-xl font-semibold bg-black text-white border-2 rounded-lg transition-all duration-200
                                ${isBlinking ? 'animate-pulse border-white' : 'border-blue-500 border-t-pink-500 border-l-pink-500'}
                                ${!isButtonActive ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 hover:border-white'}`}
                        >
                            {genre}
                        </button>
                    );
                })}
            </div>
             {!isChoiceRound && !isAnimating && <p className="mt-4 text-xl animate-pulse">Click the selected genre to continue!</p>}
        </div>
    );
};

export default App;
