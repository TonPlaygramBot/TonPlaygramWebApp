import React from 'react';
import {createRoot} from 'react-dom/client';
import PanoramaPreview from './PanoramaPreview';
import './region.css';
createRoot(document.getElementById('tirana-panorama-preview')!).render(<React.StrictMode><div className="tr-region"><PanoramaPreview/></div></React.StrictMode>);
