import { canReachCounter } from "./shared/streetLayout.mjs";
import { useState } from "react";
import { WEAPONS, WEAPON_BY_ID } from "./shared/weapons.mjs";
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
  const near = canReachCounter(player, state.shop);
  const canShop =
    near && wantedStars(player.wanted) === 0 && player.health > 0;
  return (
    <div className="ts-arsenal">
      <div className="ts-shop-balance">
        <span>{near ? "Arben · Weapon dealer" : "Your loadout"}</span>
        <strong>${player.cash.toLocaleString()} street cash</strong>
      </div>
      <p>
        {!near
          ? "Enter Arben’s shop through the open glass doorway, then walk to the counter."
          : player.wanted
            ? "Arben is closed during a pursuit. Lose your wanted stars first."
            : "Choose a weapon or refill its ammunition. Health and armor are available here."}
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
        {player.shopMessage || "Owned weapons can be equipped anywhere."}
      </div>
      <div className="ts-shop-list">
        <div className="ts-shop-item">
          <div>
            <strong>Health / armor</strong>
            <small>Recover and prepare for your next run.</small>
          </div>
          <button
            disabled={!canShop || player.cash < 90 || player.health >= 100}
            onClick={() => onAction("buy:medkit")}
          >
            HEAL $90
          </button>
          <button
            disabled={!canShop || player.cash < 180 || player.armor >= 100}
            onClick={() => onAction("buy:armor")}
          >
            ARMOR $180
          </button>
        </div>
        {WEAPONS.filter(
          (w) => category === "all" || w.category === category,
        ).map((w) => {
          const owned = player.inventory[w.id],
            selected = player.weapon === w.id;
          const price = owned
            ? Math.max(30, Math.round(w.price * 0.2))
            : w.price;
          return (
            <div
              key={w.id}
              className={`ts-shop-item ${selected ? "equipped" : ""}`}
            >
              <WeaponThumbnail model={w.model} label={w.label} />
              <div>
                <strong>{w.label}</strong>
                <small>
                  {w.category} · {w.magazine} rounds
                  {owned
                    ? ` · ${owned.ammo + owned.reserve} available`
                    : ""}
                </small>
              </div>
              {owned && (
                <button
                  aria-pressed={selected}
                  disabled={selected}
                  onClick={() => onAction(`equip:${w.id}`)}
                >
                  {selected ? "EQUIPPED" : "EQUIP"}
                </button>
              )}
              <button
                disabled={
                  !canShop ||
                  player.cash < price ||
                  (!!owned && owned.reserve >= w.magazine * 8)
                }
                onClick={() => onAction(`buy:${w.id}`)}
              >
                {owned ? "AMMO" : "BUY"} ${price}
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
        Street cash and ammunition are for this run. Career reputation and
        chapter unlocks save to your account.
      </p>
    </div>
  );
}
