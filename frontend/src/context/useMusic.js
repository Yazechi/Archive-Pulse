import { useContext } from 'react';
import { MusicContext } from './musicContextInternal';

export const useMusic = () => useContext(MusicContext);
