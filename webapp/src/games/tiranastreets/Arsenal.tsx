import { nearestShop } from './shared/cityPopulation.mjs';
import { useEffect, useState } from "react";
import { WEAPON_BY_ID } from "./shared/weapons.mjs";
import { WEAPON_STORE_CATALOG } from './weaponStoreCatalog.mjs';
import { loadWeaponStoreAccount, purchaseWeapon } from './weaponStoreApi';
import { wantedStars } from "./shared/cityLife.mjs";
import type { Player, State } from "./shared/engine.mjs";
import { WeaponThumbnail } from "./WeaponThumbnail";

export function Arsenal({
  player,
  state,
  onAction,
}: {
  player: Player;
  state: State;
  onAction: (action: string) => void;
}) {
  const [category, setCategory] = useState("all");
  const [account, setAccount] = useState<{balanceTPG:number; ownedWeaponIds:string[]}|null>(null);
  const [pending, setPending] = useState('');
  const [feedback, setFeedback] = useState('Checking your TPG account…');
  useEffect(() => {
    let live = true;
    loadWeaponStoreAccount().then((next) => {
      if (live) { setAccount(next); setFeedback('Select a display to purchase or equip.'); }
    }).catch((error) => live && setFeedback(error.message));
    return () => { live = false; };
  }, []);
  const near =
    !player.carId &&
    !!nearestShop(state,player) && Math.hypot(player.x - nearestShop(state,player).x, player.z - nearestShop(state,player).z) <= 9;
  const canShop = near && wantedStars(player.wanted) === 0 && player.health > 0;
  return (
    <div className="ts-arsenal">
      <div className="ts-shop-balance">
        <span>{near ? "Arben · Weapon dealer" : "Your loadout"}</span>
        <strong>{account ? `${account.balanceTPG.toLocaleString()} TPG` : 'TPG —'}</strong>
      </div>
      <p>
        {!near
          ? "Find any lime Arsenal marker on the city map to buy equipment."
          : player.wanted
            ? "Arben is closed during a pursuit. Lose your wanted stars first."
            : "Choose a weapon from the physical display. Purchases use your verified TPG account."}
      </p>
      <div
        className="ts-shop-filters"
        role="group"
        aria-label="Weapon category"
      >
        {[
          "all",
          "sidearm",
          "smg",
          "rifle",
          "shotgun",
          "marksman",
          "launcher",
        ].map((c) => (
          <button
            key={c}
            className={category === c ? "active" : ""}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="ts-shop-feedback" role="status">
        {pending ? 'Transaction pending — keep the shop open…' : feedback || player.shopMessage}
      </div>
      <div className="ts-shop-list">
        {WEAPON_STORE_CATALOG.filter(
          (w) => category === "all" || w.category === category,
        ).map((w) => {
          const owned = account?.ownedWeaponIds.includes(w.weaponId),
            selected = player.weapon === w.weaponId;
          return (
            <div
              key={w.id}
              className={`ts-shop-item ${selected ? "equipped" : ""}`}
            >
              <WeaponThumbnail model={w.model} label={w.displayName} />
              <div>
                <strong>{w.displayName}</strong>
                <small>
                  {w.category} · {w.priceTPG.toLocaleString()} TPG
                </small>
              </div>
              {owned && (
                <button
                  aria-pressed={selected}
                  disabled={selected}
                  onClick={() => onAction(`equip:${w.weaponId}`)}
                >
                  {selected ? "EQUIPPED" : "EQUIP"}
                </button>
              )}
              <button
                disabled={
                  !canShop || !account || !!owned || pending === w.id || account.balanceTPG < w.priceTPG
                }
                onClick={async () => {
                  setPending(w.id); setFeedback('Validating price and balance…');
                  try {
                    const receipt = await purchaseWeapon(w.id, crypto.randomUUID());
                    setAccount(receipt);
                    // The unlock below mirrors the server receipt into this run;
                    // persistent ownership remains server authoritative.
                    player.inventory[w.weaponId] ||= { ammo: WEAPON_BY_ID.get(w.weaponId)?.magazine || 16, reserve: (WEAPON_BY_ID.get(w.weaponId)?.magazine || 16) * 4 };
                    onAction(`equip:${w.weaponId}`);
                    setFeedback(`${w.displayName} unlocked. ${receipt.balanceTPG.toLocaleString()} TPG remaining.`);
                  } catch (error) { setFeedback(error instanceof Error ? error.message : 'Purchase failed.'); }
                  finally { setPending(''); }
                }}
              >
                {owned ? "OWNED" : `BUY ${w.priceTPG.toLocaleString()} TPG`}
              </button>
            </div>
          );
        })}
      </div>
      <button className="ts-menu-row" onClick={() => onAction("holster")}>
        {player.weapon
          ? `Holster ${WEAPON_BY_ID.get(player.weapon)?.label || "weapon"}`
          : "Draw your weapon"}
      </button>
      <p className="ts-shop-note">
        Weapon ownership is validated, charged and saved by the TPG backend.
        Interrupted requests are safe to retry with the same transaction key.
      </p>
    </div>
  );
}
