# Pool Royal — Cue Ball Spinning Controller (Realistic Physics)

> Fokus: fizikë reale (jo arcade) me impulse linear + torque, dhe tranzicion korrekt **sliding → rolling** për backspin/draw.

## Detyra 1 — Drejtimet e spin-it (offset në disk 2D)

Offset-i është pika e kontaktit të shkopit mbi diskun e cue ball. Le të jetë **x** majtas/djathtas dhe **y** lart/poshtë në disk (nga perspektiva e lojtarit në tavolinë). Shkalla është `|offset| ≤ maxOffset`.

| Tipi | Offset tipik | Efekti fizik (shkurt) |
| --- | --- | --- |
| A) **STUN** | `(0, 0)` | Goditje pa spin: topi rrëshqet fillimisht, pastaj kalon në rolling pa kthim mbrapsht. |
| B) **TOPSPIN / FOLLOW** | `(0, +0.25)` deri `(0, +0.65)` | Shton rrotullim përpara: topi “ngrihet” shpejt në rolling dhe vazhdon përpara pas kontaktit. |
| C) **BACKSPIN / DRAW** | `(0, -0.25)` deri `(0, -0.65)` | Shton rrotullim mbrapsht: topi shkon përpara, rrëshqet, mund të bëjë **stun**, pastaj kthehet mbrapsht kur v_rel → 0. |
| D) **LEFT ENGLISH** | `(-0.25, 0)` deri `(-0.65, 0)` | Shton spin anësor majtas: ndikon në angle të banks/contacts dhe drift gjatë sliding. |
| E) **RIGHT ENGLISH** | `(+0.25, 0)` deri `(+0.65, 0)` | Shton spin anësor djathtas: simetrik me left english. |
| F) **TOPSPIN + SIDESPIN** | `(±0.25, +0.25)` deri `(±0.65, +0.65)` | Kombinon follow me english: shpejton rolling dhe shton drift/ndikim anësor. |
| G) **BACKSPIN + SIDESPIN** | `(±0.25, -0.25)` deri `(±0.65, -0.65)` | Kombinon draw me english: rrëshqitje më e gjatë + kthim mbrapsht + ndikim anësor. |

> Shënim: offset-ët janë shembuj. Përdor `maxOffset = 0.70` si kufi realist.

## Detyra 2 — Mapping realist i input-it (deadzone + gamma curve)

Input-i i përdoruesit jep `offsetRaw = (x, y)` në rrethin `[-1..1]`. Për kontroll realist përdor **deadzone** dhe **gamma curve**:

**Parametra**
- `maxOffset = 0.70`
- `deadzone = 0.10`
- `gamma = 1.8` (tune 1.6–2.2)

**Formula**
```
distance = sqrt(x^2 + y^2)
if distance == 0: offsetScaled = (0,0)
else:
  t = clamp((distance - deadzone) / (maxOffset - deadzone), 0..1)
  scaledMagnitude = t^gamma
  offsetScaled = normalize(x, y) * (scaledMagnitude * maxOffset)
```

**Pse është më realist se linear?**
- **Afër qendrës**: deadzone heq “zgjatjet” e vogla të gishtit dhe mban spin minimal.
- **Kontroll i mirë**: gamma>1 bën ramp më të butë në fillim, kështu lojtarët bëjnë stun/light spin pa “over-shoot”.
- **Max i kufizuar**: `maxOffset` mban spin-in brenda kufijve realë.

## Detyra 3 — Goditja (strike) si impulse linear + torque

Goditja është një **impulse** në planin e tavolinës. Spin-i del nga **torque impulse** i krijuar nga `r_offset`.

**Kërkesa**
- `d` = unit vector në planin e tavolinës (drejtimi i goditjes)
- `J = f(P)` = impulse linear në N·s
- `I = (2/5) * m * r^2` për sferë të plotë

**Pseudokod**
```pseudo
function strikeCueBall(d, P, offsetScaled):
  J = impulseFromPower(P)                # N·s
  v += (J / m) * d

  r_offset = (offsetScaled.x * r, offsetScaled.y * r, 0)
  torqueImpulse = cross(r_offset, J * d)
  ω += torqueImpulse / I
```

> Mos modifiko `v` direkt për backspin: efekti duhet të dalë vetëm nga impulse linear + torque dhe fërkimi në tavolinë.

## Detyra 4 — Sliding → Rolling (kritike për draw korrekt)

Logjika e kontaktit me tavolinën bazohet te **shpejtësia relative** në pikën e kontaktit:

- `r_c = (0, -r, 0)` (nga qendra te pika e poshtme e topit)
- `v_rel = v + cross(ω, r_c)`

**Pseudokod**
```pseudo
function stepCueBall(dt):
  r_c = (0, -r, 0)
  v_rel = v + cross(ω, r_c)

  if length(v_rel) > eps:
    # SLIDING
    F = -μ_k * m * g * normalize(v_rel)
    v += (F / m) * dt
    ω += (cross(r_c, F) / I) * dt
  else:
    # ROLLING
    v *= (1 - k_roll * dt)
    ω *= (1 - k_spin * dt)
```

**Parametra fillestarë**
- `μ_k`: 0.20–0.30
- `k_roll`: 0.05–0.20 (varet nga dt dhe shkalla)
- `k_spin`: 0.02–0.10
- `g`: 9.81
- `dt`: 1/120 ose 1/240

## Detyra 5 — Çfarë duhet shmangur (pse backspin “ngrin”)

- **Apliko forcë mbrapsht (negative velocity)**: është jo-fizike; e prish momentumin dhe jep kthim të rremë pa sliding/rolling.
- **Damping i madh i ω gjatë sliding**: zhduk backspin-in para se të konvertohet në draw; topi ndalon në vend.
- **Mungesë e kontrollit slip→roll (v_rel nuk përdoret)**: pa `v_rel` nuk ka tranzicion korrekt, prandaj draw nuk ndodh.

## Detyra 6 — Output i kërkuar (mbledhje e shpejtë)

### Offset tipike A–G
- **Stun**: `(0, 0)`
- **Topspin i lehtë**: `(0, +0.25)` · **Topspin i fortë**: `(0, +0.65)`
- **Draw i lehtë**: `(0, -0.25)` · **Draw i fortë**: `(0, -0.65)`
- **Left English i lehtë**: `(-0.25, 0)` · **i fortë**: `(-0.65, 0)`
- **Right English i lehtë**: `(+0.25, 0)` · **i fortë**: `(+0.65, 0)`
- **Topspin + Sidespin**: `(±0.25, +0.25)` → `(±0.65, +0.65)`
- **Backspin + Sidespin**: `(±0.25, -0.25)` → `(±0.65, -0.65)`

### Mapping (deadzone + gamma)
```
distance = sqrt(x^2 + y^2)
if distance == 0: offsetScaled = (0,0)
else:
  t = clamp((distance - deadzone) / (maxOffset - deadzone), 0..1)
  scaledMagnitude = t^gamma
  offsetScaled = normalize(x, y) * (scaledMagnitude * maxOffset)
```

### Pseudokod minimal
```pseudo
function computeOffsetScaled(rawX, rawY):
  distance = sqrt(rawX^2 + rawY^2)
  if distance == 0: return (0, 0)
  t = clamp((distance - deadzone) / (maxOffset - deadzone), 0..1)
  scaledMagnitude = t^gamma
  return normalize(rawX, rawY) * (scaledMagnitude * maxOffset)

function strikeCueBall(d, P, offsetScaled):
  J = impulseFromPower(P)
  v += (J / m) * d
  r_offset = (offsetScaled.x * r, offsetScaled.y * r, 0)
  torqueImpulse = cross(r_offset, J * d)
  ω += torqueImpulse / I

function stepCueBall(dt):
  r_c = (0, -r, 0)
  v_rel = v + cross(ω, r_c)
  if length(v_rel) > eps:
    F = -μ_k * m * g * normalize(v_rel)
    v += (F / m) * dt
    ω += (cross(r_c, F) / I) * dt
  else:
    v *= (1 - k_roll * dt)
    ω *= (1 - k_spin * dt)
```
