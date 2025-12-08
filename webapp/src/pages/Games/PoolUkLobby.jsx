import PoolRoyaleLobby from './PoolRoyaleLobby.jsx';

export default function PoolUkLobby() {
  return (
    <PoolRoyaleLobby
      gameId="pooluk"
      gameName="8 Pool UK"
      variantOptions={[{ id: 'uk', label: '8 Pool UK' }]}
      defaultVariant="uk"
      gamePath="/games/pooluk"
      onlineGameType="pooluk"
    />
  );
}
