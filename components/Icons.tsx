
import React from 'react';

export const SpotifyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm4.183 14.232c-.276.438-.84.577-1.277.301-2.652-1.625-5.992-1.888-9.935-.981-.522.123-.972-.218-.972-.711 0-.465.419-.836.94-.949 4.356-.992 8.08- .692 11.053 1.128.438.276.577.84.301 1.277l-.21.335zm1.24-2.822c-.33.522-.992.693-1.514.363-2.982-1.846-7.468-2.378-11.229-1.298-.627.181-1.209-.246-1.39-.873-.18-.627.246-1.209.873-1.39 4.29-1.22 8.28-.63 11.737 1.545.522.33.693.992.363 1.514l-.24.394zm.028-2.946c-3.535-2.121-9.352-2.312-13.018-1.28C4.5 9.39 3.863 8.868 3.659 8.24c-.204-.627.318-1.264.945-1.468 4.145-1.155 10.518-.936 14.593 1.498.627.375.836 1.116.462 1.742-.375.627-1.116.836-1.742.462l-.273-.162z" />
  </svg>
);

export const GameLogo: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`font-black text-center text-white ${className}`} style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
    <h1 className="text-6xl md:text-8xl tracking-tighter leading-none">TRACK</h1>
    <h1 className="text-7xl md:text-9xl tracking-tight leading-none text-pink-500">ATTACK</h1>
  </div>
);

const DiceFace: React.FC<{ dots: number[] }> = ({ dots }) => (
    <div className="w-24 h-24 bg-white rounded-lg shadow-lg flex items-center justify-center p-2">
        <div className="grid grid-cols-3 grid-rows-3 w-full h-full gap-1">
            {[...Array(9)].map((_, i) => (
                <div key={i} className="flex items-center justify-center">
                    {dots.includes(i + 1) && <div className="w-4 h-4 bg-black rounded-full"></div>}
                </div>
            ))}
        </div>
    </div>
);

export const DiceIcon: React.FC<{ value: number }> = ({ value }) => {
    const dotMap: { [key: number]: number[] } = {
        3: [1, 5, 9],
        4: [1, 3, 7, 9],
        5: [1, 3, 5, 7, 9],
        7: [1, 3, 4, 5, 6, 7, 9] // Not a real dice, but for the game
    };
    return <DiceFace dots={dotMap[value] || []} />;
};
