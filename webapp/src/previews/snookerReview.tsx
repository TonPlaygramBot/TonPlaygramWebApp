import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import SnookerRoyal from '../pages/Games/SnookerRoyal.jsx';
import '../index.css';
createRoot(document.getElementById('root')!).render(<BrowserRouter><SnookerRoyal /></BrowserRouter>);
