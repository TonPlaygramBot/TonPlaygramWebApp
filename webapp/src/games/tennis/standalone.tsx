import React from 'react';
import { createRoot } from 'react-dom/client';
import TennisGame from './Game';
import { previewServices } from './career';
import './game.css';

const root = document.getElementById('tennis-royal-preview');
if (root)
  createRoot(root).render(
    <TennisGame
      services={previewServices()}
      inline
      launch={{ mode: 'ai', surface: 'hard', difficulty: 2, format: 'quick' }}
    />
  );
