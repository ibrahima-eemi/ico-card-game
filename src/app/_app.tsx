import { GameProvider } from "@/context/GameContext";

import { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <GameProvider>
      <Component {...pageProps} />
    </GameProvider>
  );
}
