import React from 'react';
import { createRoot } from 'react-dom/client';
import TableTennisGame from './Game';
import { previewServices } from './career';
import './game.css';
const root = document.getElementById('table-tennis-preview');
const launch = {
  mode: 'ai',
  arena: 'dancingHall',
  character: 'athlete-male',
  difficulty: 2,
  format: 'quick'
};
if (root)
  createRoot(root).render(
    <TableTennisGame services={previewServices()} launch={launch} inline />
  );
