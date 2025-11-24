import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
import FlagPickerModal from '../../components/FlagPickerModal.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  ensureAccountId,
  getTelegramId,
  getTelegramPhotoUrl,
  getTelegramFirstName
} from '../../utils/telegram.js';
import { getAccountBalance, addTransaction } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import { resolveTableSize, TABLE_SIZE_LIST } from '../../config/poolRoyaleTables.js';
import { socket } from '../../utils/socket.js';
import { getOnlineUsers } from '../../utils/api.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';

const PLAYER_FLAG_STORAGE_KEY = 'snookerPlayerFlag';
const AI_FLAG_STORAGE_KEY = 'snookerAiFlag';

export default function SnookerLobby() {
  const navigate = useNavigate();
  const { search } = useLocation();
  useTelegramBackButton();

  const searchParams = new URLSearchParams(search);
  const initialPlayType = (() => {
    const requestedType = searchParams.get('type');
    return requestedType === 'training' || requestedType === 'tournament'
      ? requestedType
      : 'regular';
  })();

  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [mode, setMode] = useState('ai');
  const [avatar, setAvatar] = useState('');
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [showAiFlagPicker, setShowAiFlagPicker] = useState(false);
  const [playerFlagIndex, setPlayerFlagIndex] = useState(null);
  const [aiFlagIndex, setAiFlagIndex] = useState(null);
  const [variant, setVariant] = useState('snooker');
  const [playType, setPlayType] = useState(initialPlayType);
  const [players, setPlayers] = useState(8);
  const [trainingVariant, setTrainingVariant] = useState('snooker');
  const [trainingMode, setTrainingMode] = useState('solo');
  const [trainingRulesEnabled, setTrainingRulesEnabled] = useState(true);
  const [tableSize, setTableSize] = useState(
    resolveTableSize(searchParams.get('tableSize') || 'snooker').id
  );
  const [onlinePlayers, setOnlinePlayers] = useState([]);
  const [matching, setMatching] = useState(false);
  const [spinningPlayer, setSpinningPlayer] = useState('');
  const [matchPlayers, setMatchPlayers] = useState([]);
  const [matchTableId, setMatchTableId] = useState('');
  const [readyList, setReadyList] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [matchingError, setMatchingError] = useState('');
  const spinIntervalRef = useRef(null);
  const accountIdRef = useRef(null);
  const stakeChargedRef = useRef(false);

  const selectedFlag = playerFlagIndex != null ? FLAG_EMOJIS[playerFlagIndex] : '';
  const selectedAiFlag = aiFlagIndex != null ? FLAG_EMOJIS[aiFlagIndex] : '';

  useEffect(() => {
    try {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage?.getItem(PLAYER_FLAG_STORAGE_KEY);
      const idx = FLAG_EMOJIS.indexOf(stored);
      if (idx >= 0) setPlayerFlagIndex(idx);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage?.getItem(AI_FLAG_STORAGE_KEY);
      const idx = FLAG_EMOJIS.indexOf(stored);
      if (idx >= 0) setAiFlagIndex(idx);
    } catch {}
  }, []);

  useEffect(() => {
    if (playType !== 'training') return;
    setTrainingVariant((current) => current || variant);
  }, [playType, variant]);

  const startGame = async () => {
    let tgId;
    let accountId;
    if (playType !== 'training') {
      try {
        accountId = await ensureAccountId();
        const balRes = await getAccountBalance(accountId);
        if ((balRes.balance || 0) < stake.amount) {
          alert('Insufficient balance');
          return;
        }
        tgId = getTelegramId();
        if (mode !== 'online') {
          await addTransaction(tgId, -stake.amount, 'stake', {
            game: 'snooker',
            players: playType === 'tournament' ? players : 2,
            accountId
          });
        }
      } catch {}
    } else {
      try {
        tgId = getTelegramId();
        accountId = await ensureAccountId();
      } catch {}
    }

    accountIdRef.current = accountId;

    if (mode === 'online' && playType === 'regular') {
      setMatchingError('');
      setIsSearching(true);
      stakeChargedRef.current = false;
      if (!accountId) {
        setIsSearching(false);
        setMatchingError('Unable to resolve your TPC account.');
        return;
      }
      socket.emit('register', { playerId: accountId, accountId });
      socket.emit(
        'seatTable',
        {
          accountId,
          gameType: 'snooker',
          stake: stake.amount,
          maxPlayers: 2,
          token: stake.token,
          variant,
          tableSize,
          playType,
          playerName: getTelegramFirstName() || `TPC ${accountId}`,
          avatar
        },
        (res) => {
          setIsSearching(false);
          if (res?.success) {
            setMatchTableId(res.tableId);
            setMatchPlayers(res.players || []);
            setReadyList(res.ready || []);
            socket.emit('confirmReady', {
              accountId,
              tableId: res.tableId
            });
            setMatching(true);
          } else {
            setMatchingError(
              res?.message || 'Failed to join the online arena. Please retry.'
            );
          }
        }
      );
      return;
    }

    const params = new URLSearchParams();
    const resolvedVariant = playType === 'training' ? trainingVariant : variant;
    params.set('variant', resolvedVariant || 'snooker');
    params.set('tableSize', tableSize || 'snooker');
    params.set('type', playType);
    params.set('mode', playType === 'training' ? trainingMode : mode);
    if (playType === 'training') {
      params.set('rules', trainingRulesEnabled ? 'on' : 'off');
    }
    if (playType !== 'training') {
      if (stake.token) params.set('token', stake.token);
      if (stake.amount) params.set('amount', stake.amount);
      if (playType === 'tournament') params.set('players', players);
    }
    const initData = window.Telegram?.WebApp?.initData;
    if (avatar) params.set('avatar', avatar);
    if (tgId) params.set('tgId', tgId);
    if (accountId) params.set('accountId', accountId);
    const name = getTelegramFirstName();
    if (name) params.set('name', name);
    if (selectedFlag) params.set('flag', selectedFlag);
    if (selectedAiFlag) params.set('aiFlag', selectedAiFlag);
    const devAcc = import.meta.env.VITE_DEV_ACCOUNT_ID;
    const devAcc1 = import.meta.env.VITE_DEV_ACCOUNT_ID_1;
    const devAcc2 = import.meta.env.VITE_DEV_ACCOUNT_ID_2;
    if (devAcc) params.set('dev', devAcc);
    if (devAcc1) params.set('dev1', devAcc1);
    if (devAcc2) params.set('dev2', devAcc2);
    if (initData) params.set('init', encodeURIComponent(initData));

    if (playType === 'tournament') {
      window.location.href = `/pool-royale-bracket.html?${params.toString()}`;
      return;
    }

    navigate(`/games/snooker?${params.toString()}`);
  };

  const winnerParam = searchParams.get('winner');

  useEffect(() => {
    socket.on('playerSeated', (payload) => {
      setMatchPlayers(payload.players || []);
      setReadyList(payload.ready || []);
    });

    socket.on('readyConfirmed', (payload) => {
      setReadyList(payload.ready || []);
    });

    socket.on('gameStarted', (payload) => {
      if (payload.players.some((p) => p.accountId === accountIdRef.current)) {
        if (!stakeChargedRef.current && stake.amount) {
          const owner = payload.players.find((p) => p.isOwner)?.accountId;
          if (owner === accountIdRef.current) {
            addTransaction(payload.tableId, stake.amount, 'stake', {
              game: 'snooker',
              players: 2,
              accountId: accountIdRef.current
            });
            stakeChargedRef.current = true;
          }
        }

        const params = new URLSearchParams();
        params.set('variant', payload.variant || 'snooker');
        params.set('tableSize', payload.tableSize || 'snooker');
        params.set('type', 'regular');
        params.set('mode', 'online');
        params.set('tableId', payload.tableId);
        params.set('token', payload.token);
        params.set('amount', payload.stake);
        params.set('accountId', accountIdRef.current || '');
        params.set('name', getTelegramFirstName() || 'Player');
        params.set('opponent', payload.players.find((p) => !p.isOwner)?.name || '');
        if (selectedFlag) params.set('flag', selectedFlag);
        navigate(`/games/snooker?${params.toString()}`);
      }
    });

    return () => {
      socket.off('playerSeated');
      socket.off('readyConfirmed');
      socket.off('gameStarted');
    };
  }, [navigate, selectedFlag, stake.amount]);

  useEffect(() => {
    const fetchOnlinePlayers = async () => {
      try {
        const users = await getOnlineUsers('snooker');
        setOnlinePlayers(users);
      } catch {}
    };

    fetchOnlinePlayers();
    const interval = setInterval(fetchOnlinePlayers, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!matching) return;
    const interval = setInterval(() => {
      setSpinningPlayer((prev) => {
        if (!matchPlayers.length) return prev;
        const currentIndex = matchPlayers.findIndex((p) => p.name === prev);
        const nextIndex = (currentIndex + 1) % matchPlayers.length;
        return matchPlayers[nextIndex]?.name || prev;
      });
    }, 1200);

    spinIntervalRef.current = interval;

    return () => clearInterval(interval);
  }, [matching, matchPlayers]);

  return (
    <div className="relative p-4 space-y-4 text-text min-h-screen tetris-grid-bg">
      {winnerParam && (
        <div className="text-center font-semibold">
          {winnerParam === '1' ? 'You won!' : 'CPU won!'}
        </div>
      )}
      <h2 className="text-xl font-bold text-center">3D Snooker Lobby</h2>

      <RoomSelector
        stake={stake}
        setStake={setStake}
        variant={variant}
        setVariant={setVariant}
        playType={playType}
        setPlayType={setPlayType}
        players={players}
        setPlayers={setPlayers}
        trainingVariant={trainingVariant}
        setTrainingVariant={setTrainingVariant}
        trainingMode={trainingMode}
        setTrainingMode={setTrainingMode}
        trainingRulesEnabled={trainingRulesEnabled}
        setTrainingRulesEnabled={setTrainingRulesEnabled}
        mode={mode}
        setMode={setMode}
        avatar={avatar}
        setAvatar={setAvatar}
        onlinePlayers={onlinePlayers}
        tableSize={tableSize}
        tableSizes={TABLE_SIZE_LIST}
        setTableSize={setTableSize}
        selectedFlag={selectedFlag}
        setShowFlagPicker={setShowFlagPicker}
        selectedAiFlag={selectedAiFlag}
        setShowAiFlagPicker={setShowAiFlagPicker}
        isSearching={isSearching}
        startGame={startGame}
        matching={matching}
        matchingError={matchingError}
        matchTableId={matchTableId}
        matchPlayers={matchPlayers}
        readyList={readyList}
        spinningPlayer={spinningPlayer}
        gameType="snooker"
      />

      <FlagPickerModal
        isOpen={showFlagPicker}
        onClose={() => setShowFlagPicker(false)}
        onSelect={(index) => {
          setPlayerFlagIndex(index);
          try {
            window.localStorage?.setItem(PLAYER_FLAG_STORAGE_KEY, FLAG_EMOJIS[index]);
          } catch {}
        }}
      />
      <FlagPickerModal
        isOpen={showAiFlagPicker}
        onClose={() => setShowAiFlagPicker(false)}
        onSelect={(index) => {
          setAiFlagIndex(index);
          try {
            window.localStorage?.setItem(AI_FLAG_STORAGE_KEY, FLAG_EMOJIS[index]);
          } catch {}
        }}
        title="Select AI Flag"
      />
    </div>
  );
}
