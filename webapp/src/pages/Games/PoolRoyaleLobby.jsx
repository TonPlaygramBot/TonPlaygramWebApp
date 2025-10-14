import BilliardsLobbyBase from '../../components/billiards/BilliardsLobbyBase.jsx';

const VARIANT_OPTIONS = [
  { id: 'american', label: 'American' },
  { id: '9ball', label: '9-Ball' },
  { id: 'uk', label: '8 Pool UK' }
];

export default function PoolRoyaleLobby() {
  return (
    <BilliardsLobbyBase
      title="Pool Royale Lobby"
      gamePath="/games/pollroyale"
      initialVariant="american"
      variantOptions={VARIANT_OPTIONS}
    />
  );
}
