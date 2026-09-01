import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const html = fs.readFileSync('webapp/public/games/black-tide/index.html', 'utf8')
const game = fs.readFileSync('webapp/public/games/black-tide/assets/index-D_JCahlX.js', 'utf8')
const online = fs.readFileSync('webapp/public/games/black-tide/online.js', 'utf8')

test('Black Tide declares English metadata and mobile-facing controls', () => {
  assert.match(html, /<html lang="en">/)
  assert.match(html, /a cinematic 3D action campaign/)
  for (const label of ['CONTINUE CAMPAIGN', 'START MISSION', 'STEER', 'BRAKE', 'GAS', 'MOVE', 'WEAPON', 'ACTION', 'FIRE']) {
    assert.ok(game.includes(label), `missing English label: ${label}`)
  }
})

test('Black Tide no longer ships Albanian shell and HUD labels', () => {
  for (const label of ['VAZHDO FUSHATËN', 'NIS MISIONIN', 'TIMON', 'FRENË', 'LËVIZJE', 'VEPRIM', 'ZJARR', 'Menuja kryesore']) {
    assert.equal(game.includes(label), false, `found Albanian label: ${label}`)
  }
})

test('all campaign narrative and mission objectives are English', () => {
  const campaignStart = game.indexOf('const yi=[')
  const campaignEnd = game.indexOf('const of=', campaignStart)
  const campaign = game.slice(campaignStart, campaignEnd)
  assert.ok(campaignStart > 0 && campaignEnd > campaignStart)
  assert.doesNotMatch(campaign, /[ëËçÇ]|MISIONI|KREDITE|Përfundo|Arrij|Mbro/)
  assert.match(campaign, /Silent Port/)
  assert.match(campaign, /The (Last|Final) Tide/)
})

test('Chess human, Ludo weapon families and online sync are wired into Black Tide', () => {
  assert.match(game, /threejs\.org\/examples\/models\/gltf\/readyplayer\.me\.glb/)
  for (const weapon of ['SIGSAUER', 'SMITH REVOLVER', 'UZI', 'AK-47', 'KRSV', 'MOSIN', 'SHOTGUN', 'SAWED-OFF', 'GRENADE LAUNCHER', 'BAZOOKA', 'HAND GRENADE', 'DYNAMITE', 'MOLOTOV', 'GAS TANK', 'LARGE ROBOT GUN', 'FLYING ROBOT GUN']) {
    assert.ok(game.includes(`name:"${weapon}"`), `missing weapon: ${weapon}`)
  }
  assert.match(online, /joinBlackTideTable/)
  assert.match(online, /blackTideState/)
  assert.match(game, /updateOnlineAllyMovement/)
  assert.match(game, /ludo-weapon-/)
  assert.match(html, /black-tide\/online\.js/)
})
