import React from 'react';
import { createRoot } from 'react-dom/client';
import TableTennisGame from './Game';
import { previewServices } from './career';
import './game.css';
const root = document.getElementById('table-tennis-preview');
if (root)
  createRoot(root).render(
    <TableTennisGame services={previewServices()} inline />
  );
