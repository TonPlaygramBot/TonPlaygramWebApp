import React from 'react';
import PlayerToken from './PlayerToken.jsx';

export default function LudoToken({ color = 'red', photoUrl }) {
  return (
    <PlayerToken color={color} photoUrl={photoUrl} />
  );
}
