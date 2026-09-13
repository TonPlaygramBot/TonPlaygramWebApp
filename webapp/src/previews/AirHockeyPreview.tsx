import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import AirHockey3D from '../components/AirHockey3D.jsx';
import '../index.css';
const player = { name: 'You', avatar: '🇦🇱' };
const opponent = { name: 'Opponent', avatar: '🇬🇧' };
const container = document.getElementById('air-hockey-review');
if (container) createRoot(container).render(<MemoryRouter><AirHockey3D player={player} ai={opponent} target={11} /></MemoryRouter>);
