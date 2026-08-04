import React, { useEffect, useState } from 'react';

import { createPortal } from 'react-dom';

import { FiCopy } from 'react-icons/fi';

import { getProfileByAccount, sendFriendRequest } from '../utils/api.js';

import { getTelegramId } from '../utils/telegram.js';

import { getAvatarUrl } from '../utils/avatarUtils.js';

import { NFT_GIFTS } from '../utils/nftGifts.js';
import GiftIcon from './GiftIcon.jsx';
import PlayerInvitePopup from './PlayerInvitePopup.jsx';

const GAME_NAME_MAP = {
  snake: 'Snake & Ladder',
  pool: 'Pool Royale',
  snooker: 'Snooker Royal',
  texas: "Texas Hold'em",
  domino: 'Domino Royal 3D',
  murlan: 'Murlan Royale',
};

function getGameName(slug = '') {
  const entry = Object.entries(GAME_NAME_MAP).find(([key]) =>
    slug.startsWith(key)
  );
  return entry ? entry[1] : slug;
}

export default function TransactionDetailsPopup({ tx, onClose }) {

  const [counterparty, setCounterparty] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [friendship, setFriendship] = useState('none');

  useEffect(() => {

    if (!tx) return;

    const giftSend = tx.type === 'gift';

    const isSend = tx.type === 'send' || giftSend;

    const acct = isSend ? tx.toAccount : tx.fromAccount;

    if (!acct) {

      setCounterparty(null);

      return;

    }

    getProfileByAccount(acct)

      .then((profile) => setCounterparty(profile || null))

      .catch(() => setCounterparty(null));

  }, [tx]);

  if (!tx) return null;

  const token = (tx.token || 'TPC').toUpperCase();

  const iconMap = {

    TPC: '/assets/icons/ezgif-54c96d8a9b9236.webp',

    TON: '/assets/icons/TON.webp',

    USDT: '/assets/icons/Usdt.webp'

  };

  const icon = iconMap[token] || `/assets/icons/${token}.webp`;

  const isGiftSend = tx.type === 'gift';

  const isGiftReceive = tx.type === 'gift-receive';

  const isSend = tx.type === 'send' || isGiftSend;

  const isReceive = tx.type === 'receive' || isGiftReceive;

  const account = isSend ? tx.toAccount : tx.fromAccount;

  const nameOverride = isSend ? tx.toName : tx.fromName;

  const nameFromProfile =

    counterparty?.nickname || `${counterparty?.firstName || ''} ${counterparty?.lastName || ''}`.trim();

  const displayName = nameOverride || nameFromProfile || '';
  const gameName = tx.game ? getGameName(tx.game) : '';

  const gift = (isGiftSend || isGiftReceive) && tx.detail

    ? NFT_GIFTS.find((g) => g.id === tx.detail)

    : null;

  const giftFee = gift ? Math.round(gift.price * 0.1) : null;

  const sign = tx.amount > 0 ? '+' : '-';

  const formattedAmount = Math.abs(tx.amount).toLocaleString(undefined, {

    minimumFractionDigits: 2,

    maximumFractionDigits: 2,

  });

  const openCounterpartyProfile = () => {
    if (counterparty) setProfileOpen(true);
  };

  const popup = createPortal(

    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">

      <div className="relative p-4 space-y-4 w-80 rounded-xl border border-border bg-surface text-text overflow-hidden">

        <img
          src="/assets/icons/snakes_and_ladders.webp"
          className="background-behind-board object-cover"
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />

        <button

          onClick={onClose}

          className="absolute -top-3 -right-1 bg-black bg-opacity-70 text-white rounded-full w-5 h-5 flex items-center justify-center"

        >

          &times;

        </button>

        <h3 className="text-lg font-bold text-center">TPC Statement Details</h3>

        <div className="flex flex-col items-center space-y-2">

          <div className="flex items-center space-x-2">

            <span

              className={`font-semibold flex items-center space-x-1 ${tx.amount > 0 ? 'text-green-500' : 'text-red-500'}`}

            >

              {(() => {

                if (tx.game) {

                  return tx.amount > 0 ? 'Win' : 'Lost';

                }

                if (isGiftSend) return 'Gift Sent';

                if (isGiftReceive) return 'Gift Received';

                if (isSend) return 'Sent';

                if (isReceive) return 'Received';

                return tx.type;

              })()} {sign}{formattedAmount}

              <img src={icon} alt={token} className="w-5 h-5 inline" />

            </span>

            {tx.game && (

              <span className="text-xs capitalize">{tx.type}</span>

            )}

          </div>

          {counterparty && (

            <button
              type="button"
              onClick={openCounterpartyProfile}
              className="flex items-center space-x-2 rounded-lg p-2 text-left hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label={`View ${displayName || 'player'} profile`}
            >

                {counterparty.photo && (
                  <img
                    src={getAvatarUrl(counterparty.photo)}
                    alt="counterparty avatar"
                    className="w-7 h-7 rounded-full"
                  />
                )}

              <div className="text-left">

                <div>{isSend ? 'To:' : 'From:'} {displayName}</div>

                <div className="text-xs text-subtext flex items-center space-x-1">

                  <span>TPC Account #{account}</span>

                  <FiCopy

                    className="w-4 h-4 cursor-pointer"

                    onClick={() => navigator.clipboard.writeText(String(account))}

                  />

                </div>

              </div>

            </button>

          )}

          {!counterparty && account && (

            <div className="text-sm flex items-center space-x-1">

              <span>{isSend ? 'To' : 'From'} account #{account}</span>

              <FiCopy

                className="w-4 h-4 cursor-pointer"

                onClick={() => navigator.clipboard.writeText(String(account))}

              />

            </div>

          )}

          {gift && (
            <div className="text-sm flex items-center space-x-1">
              <span>Gift:</span>
              <GiftIcon icon={gift.icon} className="w-4 h-4" />
              <span>{gift.name}</span>
              {typeof (tx.category || gift.tier) !== 'undefined' && (
                <span className="text-xs text-subtext">(Tier {tx.category || gift.tier})</span>
              )}
            </div>
          )}

          {gift && giftFee !== null && (

            <div className="text-sm text-subtext">Fee: {giftFee} TPC</div>

          )}

          {tx.game && (
            <div className="text-sm text-subtext">
              {gameName}
              {typeof tx.players === 'number' && (
                <> vs {tx.players} {tx.players === 1 ? 'player' : 'players'}</>
              )}
            </div>
          )}

          {!gift && tx.detail && (
            <div className="text-sm text-subtext">{tx.detail}</div>
          )}

          <div className="text-xs text-subtext">
            {new Date(tx.date).toLocaleString(undefined, { hour12: false })}
          </div>

        </div>

      </div>

    </div>,

    document.body

  );

  return (
    <>
      {popup}
      <PlayerInvitePopup
        open={profileOpen}
        player={counterparty ? { ...counterparty, accountId: account } : null}
        stake={{ token: 'TPC', amount: 100 }}
        onStakeChange={() => {}}
        onInvite={() => {}}
        onClose={() => setProfileOpen(false)}
        onlineStatus="offline"
        friendship={friendship}
        profileOnly
        onAddFriend={async () => {
          const telegramId = getTelegramId();
          if (!telegramId || !counterparty?.telegramId) {
            window.alert('This player cannot receive a friend request right now.');
            return;
          }
          try {
            await sendFriendRequest(telegramId, counterparty.telegramId);
            setFriendship('pending');
          } catch (error) {
            window.alert(error?.message || 'Failed to send friend request');
          }
        }}
      />
    </>
  );

}
