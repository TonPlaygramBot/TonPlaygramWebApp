import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js'
import { createMurlanStyleTable, applyTableMaterials } from '../../utils/murlanTable.js'
import { MURLAN_TABLE_FINISHES } from '../../config/murlanTableFinishes.js'
import { getTelegramFirstName, getTelegramPhotoUrl } from '../../utils/telegram.js'
import { applyRendererSRGB, applySRGBColorSpace } from '../../utils/colorSpace.js'
import Dice from '../../components/Dice.jsx'
import BottomLeftIcons from '../../components/BottomLeftIcons.jsx'
import AvatarTimer from '../../components/AvatarTimer.jsx'
import { getGameVolume, isGameMuted } from '../../utils/sound.js'

const WHITE = 'white'
const BLACK = 'black'

const TABLE_RADIUS = 2.55
const TABLE_HEIGHT = 1.16
const CHAIR_DISTANCE = TABLE_RADIUS + 0.82
const BOARD_Y = TABLE_HEIGHT + 0.08
const POINT_WIDTH = 0.19
const BOARD_HALF_X = 1.28
const BOARD_HALF_Z = 0.98
const POINT_START_X = 0.08

const MODEL_SCALE = 0.75
const STOOL_SCALE = 1.5 * 1.3
const SEAT_WIDTH = 0.9 * MODEL_SCALE * STOOL_SCALE
const SEAT_DEPTH = 0.95 * MODEL_SCALE * STOOL_SCALE
const SEAT_THICKNESS_SCALED = 0.09 * MODEL_SCALE * STOOL_SCALE
const BACK_HEIGHT = 0.68 * MODEL_SCALE * STOOL_SCALE
const BACK_THICKNESS = 0.08 * MODEL_SCALE * STOOL_SCALE
const ARM_THICKNESS = 0.125 * MODEL_SCALE * STOOL_SCALE
const ARM_HEIGHT = 0.3 * MODEL_SCALE * STOOL_SCALE
const ARM_DEPTH = SEAT_DEPTH * 0.75
const BASE_COLUMN_HEIGHT = 0.5 * MODEL_SCALE * STOOL_SCALE
const CHAIR_BASE_HEIGHT = TABLE_HEIGHT - SEAT_THICKNESS_SCALED * 0.85
const CAMERA_2D_POSITION = new THREE.Vector3(0, 8.4, 0.01)
const CAMERA_3D_POSITION = new THREE.Vector3(0, 4.9, 5.6)
const CAMERA_TARGET = new THREE.Vector3(0, TABLE_HEIGHT, 0)
const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/'
const BASIS_TRANSCODER_PATH = 'https://cdn.jsdelivr.net/npm/three@0.164.0/examples/jsm/libs/basis/'
const BACKGAMMON_BOARD_GLTF_URLS = Object.freeze([
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ABeautifulGame/glTF-Binary/ABeautifulGame.glb',
  'https://rawcdn.githack.com/KhronosGroup/glTF-Sample-Assets/main/Models/ABeautifulGame/glTF-Binary/ABeautifulGame.glb'
])
const BACKGAMMON_HDRI_URLS = Object.freeze([
  'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/studio_small_09_2k.hdr',
  'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr',
  'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/colorful_studio_1k.hdr'
])
let sharedKtx2Loader = null
let hasDetectedKtx2Support = false
const CHAIR_MODEL_URLS = Object.freeze([
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb',
  'https://rawcdn.githack.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/SheenChair/glTF-Binary/SheenChair.glb',
  '/assets/models/chair/chair.glb',
  '/assets/models/chair/chair.gltf'
])
const CHAIR_THEMES = Object.freeze([
  { id: 'royal-red', label: 'Royal Red', primary: '#8b1d2c', leg: '#111827' },
  { id: 'emerald', label: 'Emerald', primary: '#0f766e', leg: '#0f172a' },
  { id: 'violet', label: 'Violet', primary: '#4c1d95', leg: '#111827' }
])
const QUALITY_OPTIONS = Object.freeze([
  { id: 'performance', label: 'Performance', pixelRatio: 1, shadows: false },
  { id: 'balanced', label: 'Balanced', pixelRatio: 1.5, shadows: true },
  { id: 'ultra', label: 'Ultra', pixelRatio: 2, shadows: true }
])
const MOVE_SOUND_URL = 'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Move.mp3'
const WIN_SOUND_URL = 'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/End.mp3'
const FALLBACK_SEAT_POSITIONS = [
  { left: '50%', top: '18%' },
  { left: '50%', top: '73%' }
]

function ensureKtx2SupportDetection(renderer = null) {
  if (!sharedKtx2Loader || hasDetectedKtx2Support || !renderer) return
  try {
    sharedKtx2Loader.detectSupport(renderer)
    hasDetectedKtx2Support = true
  } catch (error) {
    console.warn('Failed to detect KTX2 support for Tavull loader', error)
  }
}

function createConfiguredGLTFLoader(renderer = null) {
  const loader = new GLTFLoader()
  loader.setCrossOrigin?.('anonymous')
  const draco = new DRACOLoader()
  draco.setDecoderPath(DRACO_DECODER_PATH)
  loader.setDRACOLoader(draco)
  loader.setMeshoptDecoder?.(MeshoptDecoder)

  if (!sharedKtx2Loader) {
    sharedKtx2Loader = new KTX2Loader()
    sharedKtx2Loader.setTranscoderPath(BASIS_TRANSCODER_PATH)
  }
  ensureKtx2SupportDetection(renderer)
  loader.setKTX2Loader(sharedKtx2Loader)
  return loader
}

function prepareLoadedModel(model) {
  model?.traverse?.((obj) => {
    if (!obj?.isMesh) return
    obj.castShadow = true
    obj.receiveShadow = true
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
    materials.forEach((material) => {
      if (!material) return
      if (material.map) applySRGBColorSpace(material.map)
      if (material.emissiveMap) applySRGBColorSpace(material.emissiveMap)
    })
  })
}

async function loadBackgammonBoardModel(renderer) {
  const loader = createConfiguredGLTFLoader(renderer)
  for (const url of BACKGAMMON_BOARD_GLTF_URLS) {
    try {
      const gltf = await loader.loadAsync(url)
      const root = gltf?.scene || gltf?.scenes?.[0]
      if (!root) continue
      prepareLoadedModel(root)
      return root
    } catch (error) {
      console.warn('Failed to load Tavull open-source board model', url, error)
    }
  }
  return null
}

function loadHdriEnvironment(scene, preferredIndex = 0) {
  const rgbe = new RGBELoader()
  const ordered = [
    BACKGAMMON_HDRI_URLS[preferredIndex],
    ...BACKGAMMON_HDRI_URLS.filter((_, idx) => idx !== preferredIndex)
  ].filter(Boolean)
  const tryNext = (index = 0) => {
    if (index >= ordered.length) return
    rgbe.load(
      ordered[index],
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping
        applySRGBColorSpace(texture)
        scene.environment = texture
      },
      undefined,
      () => tryNext(index + 1)
    )
  }
  tryNext(0)
}

const initialBoard = () => {
  const points = Array.from({ length: 24 }, () => ({ color: null, count: 0 }))
  const set = (i, color, count) => {
    points[i] = { color, count }
  }
  set(23, WHITE, 2)
  set(12, WHITE, 5)
  set(7, WHITE, 3)
  set(5, WHITE, 5)
  set(0, BLACK, 2)
  set(11, BLACK, 5)
  set(16, BLACK, 3)
  set(18, BLACK, 5)
  return points
}

const cloneState = (state) => ({
  points: state.points.map((p) => ({ ...p })),
  bar: { ...state.bar },
  off: { ...state.off }
})

const other = (color) => (color === WHITE ? BLACK : WHITE)
const dirFor = (color) => (color === WHITE ? -1 : 1)
const homeRange = (color) => (color === WHITE ? [0, 5] : [18, 23])
const canLand = (point, color) => !point.color || point.color === color || point.count === 1

const canBearOff = (state, color) => {
  if (state.bar[color] > 0) return false
  const [start, end] = homeRange(color)
  for (let i = 0; i < 24; i += 1) {
    if (i < start || i > end) {
      const p = state.points[i]
      if (p.color === color && p.count > 0) return false
    }
  }
  return true
}

const hasHigherHomeChecker = (state, color, from) => {
  if (color === WHITE) {
    for (let i = from + 1; i <= 5; i += 1) {
      const p = state.points[i]
      if (p.color === WHITE && p.count > 0) return true
    }
    return false
  }
  for (let i = from - 1; i >= 18; i -= 1) {
    const p = state.points[i]
    if (p.color === BLACK && p.count > 0) return true
  }
  return false
}

const destinationForBar = (color, die) => (color === WHITE ? 24 - die : die - 1)

const getSingleDieMoves = (state, color, die) => {
  const moves = []
  if (state.bar[color] > 0) {
    const dest = destinationForBar(color, die)
    if (dest >= 0 && dest < 24 && canLand(state.points[dest], color)) {
      moves.push({ from: 'bar', to: dest, die })
    }
    return moves
  }

  const direction = dirFor(color)
  const canOff = canBearOff(state, color)

  for (let i = 0; i < 24; i += 1) {
    const p = state.points[i]
    if (p.color !== color || p.count <= 0) continue
    const dest = i + direction * die

    if (dest >= 0 && dest < 24) {
      if (canLand(state.points[dest], color)) moves.push({ from: i, to: dest, die })
      continue
    }

    if (!canOff) continue
    if (color === WHITE && dest < 0) {
      const exact = i - die === -1
      if (exact || !hasHigherHomeChecker(state, color, i)) moves.push({ from: i, to: 'off', die })
    }
    if (color === BLACK && dest > 23) {
      const exact = i + die === 24
      if (exact || !hasHigherHomeChecker(state, color, i)) moves.push({ from: i, to: 'off', die })
    }
  }

  return moves
}

const applyMove = (state, color, move) => {
  const next = cloneState(state)
  if (move.from === 'bar') {
    next.bar[color] -= 1
  } else {
    const fromPoint = next.points[move.from]
    fromPoint.count -= 1
    if (fromPoint.count === 0) fromPoint.color = null
  }

  if (move.to === 'off') {
    next.off[color] += 1
    return next
  }

  const toPoint = next.points[move.to]
  if (toPoint.color === other(color) && toPoint.count === 1) {
    toPoint.color = color
    toPoint.count = 1
    next.bar[other(color)] += 1
    return next
  }

  if (!toPoint.color) toPoint.color = color
  toPoint.count += 1
  return next
}

const permutationsForDice = (dice) => {
  if (dice.length !== 2 || dice[0] === dice[1]) return [dice]
  return [dice, [dice[1], dice[0]]]
}

const collectTurnSequences = (state, color, dice) => {
  const sequences = []
  const recurse = (currentState, diceLeft, line = [], used = []) => {
    if (!diceLeft.length) {
      sequences.push({ line, usedDice: used, resultingState: currentState })
      return
    }
    const [die, ...rest] = diceLeft
    const options = getSingleDieMoves(currentState, color, die)
    if (!options.length) {
      sequences.push({ line, usedDice: used, resultingState: currentState })
      return
    }
    options.forEach((mv) => recurse(applyMove(currentState, color, mv), rest, [...line, mv], [...used, die]))
  }

  permutationsForDice(dice).forEach((order) => recurse(state, order))

  const maxUsed = sequences.reduce((max, s) => Math.max(max, s.usedDice.length), 0)
  let filtered = sequences.filter((s) => s.usedDice.length === maxUsed)

  if (maxUsed === 1 && dice.length === 2 && dice[0] !== dice[1]) {
    const higher = Math.max(...dice)
    if (getSingleDieMoves(state, color, higher).length > 0) {
      filtered = filtered.filter((s) => s.usedDice[0] === higher)
    }
  }

  return filtered
}

const scorePosition = (state, color) => {
  const opp = other(color)
  const pip = (player) => {
    let total = state.bar[player] * 25
    for (let i = 0; i < 24; i += 1) {
      const p = state.points[i]
      if (p.color !== player) continue
      const distance = player === WHITE ? i + 1 : 24 - i
      total += p.count * distance
    }
    return total
  }

  return (pip(opp) - pip(color)) + (state.off[color] - state.off[opp]) * 20 - state.bar[color] * 8 + state.bar[opp] * 8
}

const pickAiSequence = (state, dice) => {
  const sequences = collectTurnSequences(state, BLACK, dice)
  if (!sequences.length) return null

  const outcomes = []
  for (let d1 = 1; d1 <= 6; d1 += 1) {
    for (let d2 = 1; d2 <= 6; d2 += 1) outcomes.push(d1 === d2 ? [d1, d1, d1, d1] : [d1, d2])
  }

  const expectedScoreFor = (afterAi) => {
    let total = 0
    outcomes.forEach((dicePair) => {
      const whiteSeq = collectTurnSequences(afterAi, WHITE, dicePair)
      if (!whiteSeq.length) {
        total += scorePosition(afterAi, BLACK)
        return
      }
      const whiteBest = whiteSeq.reduce((best, seq) => (scorePosition(seq.resultingState, WHITE) > scorePosition(best.resultingState, WHITE) ? seq : best), whiteSeq[0])
      total += scorePosition(whiteBest.resultingState, BLACK)
    })
    return total / outcomes.length
  }

  return sequences.reduce((best, seq) => (expectedScoreFor(seq.resultingState) > expectedScoreFor(best.resultingState) ? seq : best), sequences[0])
}

function createArenaChairFallback(chairColor = '#8b1d2c', legColor = '#111827') {
  const seatMaterial = new THREE.MeshStandardMaterial({
    color: chairColor,
    roughness: 0.42,
    metalness: 0.18
  })
  const legMaterial = new THREE.MeshStandardMaterial({
    color: legColor,
    roughness: 0.55,
    metalness: 0.38
  })
  const chair = new THREE.Group()
  const seatMesh = new THREE.Mesh(
    new THREE.BoxGeometry(SEAT_WIDTH, SEAT_THICKNESS_SCALED, SEAT_DEPTH),
    seatMaterial
  )
  seatMesh.position.y = SEAT_THICKNESS_SCALED / 2
  const backMesh = new THREE.Mesh(
    new THREE.BoxGeometry(SEAT_WIDTH * 0.96, BACK_HEIGHT, BACK_THICKNESS),
    seatMaterial
  )
  backMesh.position.set(
    0,
    SEAT_THICKNESS_SCALED / 2 + BACK_HEIGHT / 2,
    -SEAT_DEPTH / 2 + BACK_THICKNESS / 2
  )
  const armGeometry = new THREE.BoxGeometry(ARM_THICKNESS, ARM_HEIGHT, ARM_DEPTH)
  const armOffsetX = SEAT_WIDTH / 2 - ARM_THICKNESS / 2
  const armOffsetY = SEAT_THICKNESS_SCALED / 2 + ARM_HEIGHT / 2
  const armOffsetZ = -ARM_DEPTH / 2 + ARM_THICKNESS * 0.2
  const leftArm = new THREE.Mesh(armGeometry, seatMaterial)
  leftArm.position.set(-armOffsetX, armOffsetY, armOffsetZ)
  const rightArm = new THREE.Mesh(armGeometry, seatMaterial)
  rightArm.position.set(armOffsetX, armOffsetY, armOffsetZ)
  const legMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16 * MODEL_SCALE * STOOL_SCALE, 0.2 * MODEL_SCALE * STOOL_SCALE, BASE_COLUMN_HEIGHT, 18),
    legMaterial
  )
  legMesh.position.y = -SEAT_THICKNESS_SCALED / 2 - BASE_COLUMN_HEIGHT / 2
  const foot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32 * MODEL_SCALE * STOOL_SCALE, 0.32 * MODEL_SCALE * STOOL_SCALE, 0.08 * MODEL_SCALE, 24),
    legMaterial
  )
  foot.position.y = legMesh.position.y - BASE_COLUMN_HEIGHT / 2 - 0.04 * MODEL_SCALE
  ;[seatMesh, backMesh, leftArm, rightArm, legMesh, foot].forEach((mesh) => {
    mesh.castShadow = true
    mesh.receiveShadow = true
    chair.add(mesh)
  })
  return chair
}

async function loadMappedChair(renderer, theme) {
  const loader = createConfiguredGLTFLoader(renderer)
  let loaded = null
  for (const url of CHAIR_MODEL_URLS) {
    try {
      const gltf = await loader.loadAsync(url)
      loaded = gltf?.scene || gltf?.scenes?.[0]
      if (loaded) break
    } catch (error) {
      console.warn('Failed to load Backgammon chair model', url, error)
    }
  }
  if (!loaded) return createArenaChairFallback(theme.primary, theme.leg)

  const model = loaded.clone(true)
  prepareLoadedModel(model)
  const tint = new THREE.Color(theme.primary)
  const legTint = new THREE.Color(theme.leg)
  model.traverse((node) => {
    if (!node?.isMesh) return
    const mats = Array.isArray(node.material) ? node.material : [node.material]
    mats.forEach((mat) => {
      if (!mat) return
      const label = `${mat.name || ''} ${node.name || ''}`.toLowerCase()
      const hasMappedTexture = Boolean(mat.map)
      if (!hasMappedTexture) {
        if (/leg|base|metal|foot/.test(label)) mat.color?.lerp(legTint, 0.7)
        else mat.color?.lerp(tint, 0.55)
      }
      if (mat.map) applySRGBColorSpace(mat.map)
      if (mat.emissiveMap) applySRGBColorSpace(mat.emissiveMap)
      mat.needsUpdate = true
    })
  })
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const currentMax = Math.max(size.x, size.y, size.z)
  const targetMax = Math.max(SEAT_WIDTH, BACK_HEIGHT * 1.2, SEAT_DEPTH)
  if (currentMax > 0) model.scale.multiplyScalar(targetMax / currentMax)
  const scaledBox = new THREE.Box3().setFromObject(model)
  const center = scaledBox.getCenter(new THREE.Vector3())
  model.position.set(-center.x, -scaledBox.min.y, -center.z)
  return model
}


const pointBasePosition = (index) => {
  if (index <= 11) {
    const col = index < 6 ? index : index + 1
    return {
      x: BOARD_HALF_X - POINT_START_X - col * POINT_WIDTH,
      z: BOARD_HALF_Z - 0.08,
      top: false
    }
  }
  const i = 23 - index
  const col = i < 6 ? i : i + 1
  return {
    x: -BOARD_HALF_X + POINT_START_X + col * POINT_WIDTH,
    z: -BOARD_HALF_Z + 0.08,
    top: true
  }
}

export default function TavullBattleRoyal() {
  useTelegramBackButton()
  const canvasHostRef = useRef(null)
  const sceneBundleRef = useRef(null)

  const [game, setGame] = useState({ points: initialBoard(), bar: { white: 0, black: 0 }, off: { white: 0, black: 0 } })
  const [dice, setDice] = useState([])
  const [available, setAvailable] = useState([])
  const [message, setMessage] = useState('Roll to start. You are White.')
  const [aiThinking, setAiThinking] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [viewMode, setViewMode] = useState('3d')
  const [isRollingDice, setIsRollingDice] = useState(false)
  const [tableFinishIdx, setTableFinishIdx] = useState(0)
  const [chairThemeIdx, setChairThemeIdx] = useState(0)
  const [hdriIdx, setHdriIdx] = useState(0)
  const [qualityIdx, setQualityIdx] = useState(1)
  const playerName = getTelegramFirstName() || 'Player'
  const playerAvatar = getTelegramPhotoUrl()

  const winner = game.off.white >= 15 ? WHITE : game.off.black >= 15 ? BLACK : null

  const players = [
    {
      index: 0,
      name: playerName,
      photoUrl: playerAvatar || '/assets/icons/profile.svg',
      color: 'white',
      isTurn: !aiThinking && !winner
    },
    {
      index: 1,
      name: 'AI Royal',
      photoUrl: '/assets/icons/profile.svg',
      color: 'black',
      isTurn: aiThinking
    }
  ]

  const legalStarts = useMemo(() => {
    const starts = new Set()
    available.forEach((seq) => {
      if (seq.line[0]) starts.add(String(seq.line[0].from))
    })
    return starts
  }, [available])

  const playSfx = (url, volumeScale = 1) => {
    if (isGameMuted()) return
    try {
      const audio = new Audio(url)
      audio.volume = Math.min(1, getGameVolume() * volumeScale)
      void audio.play().catch(() => {})
    } catch {}
  }

  useEffect(() => {
    if (!canvasHostRef.current) return undefined

    const host = canvasHostRef.current
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#090f1f')

    const camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, 120)
    camera.position.copy(CAMERA_3D_POSITION)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    applyRendererSRGB(renderer)
    const initialQuality = QUALITY_OPTIONS[qualityIdx] || QUALITY_OPTIONS[1]
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, initialQuality.pixelRatio))
    renderer.setSize(host.clientWidth, host.clientHeight)
    renderer.shadowMap.enabled = Boolean(initialQuality.shadows)
    host.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = false
    controls.enableDamping = true
    controls.maxPolarAngle = Math.PI * 0.48
    controls.minDistance = 4.4
    controls.maxDistance = 8.6
    controls.target.copy(CAMERA_TARGET)

    const applyViewMode = (mode) => {
      if (mode === '2d') {
        camera.position.copy(CAMERA_2D_POSITION)
        camera.lookAt(CAMERA_TARGET)
        controls.minPolarAngle = 0.02
        controls.maxPolarAngle = Math.PI * 0.08
        controls.enableRotate = false
        controls.minDistance = 5.8
        controls.maxDistance = 11.5
      } else {
        camera.position.copy(CAMERA_3D_POSITION)
        camera.lookAt(CAMERA_TARGET)
        controls.minPolarAngle = 0.4
        controls.maxPolarAngle = Math.PI * 0.48
        controls.enableRotate = true
        controls.minDistance = 4.4
        controls.maxDistance = 8.6
      }
      controls.target.copy(CAMERA_TARGET)
      controls.update()
    }
    applyViewMode(viewMode)

    scene.add(new THREE.AmbientLight('#ffffff', 0.5))
    const key = new THREE.DirectionalLight('#ffffff', 1.15)
    key.position.set(5, 8, 3)
    key.castShadow = true
    scene.add(key)

    const fill = new THREE.PointLight('#6ec4ff', 0.7, 30)
    fill.position.set(-4, 4.5, -3)
    scene.add(fill)

    loadHdriEnvironment(scene, hdriIdx)

    const table = createMurlanStyleTable({ arena: scene, renderer, tableRadius: TABLE_RADIUS, tableHeight: TABLE_HEIGHT })
    applyTableMaterials(table.parts, MURLAN_TABLE_FINISHES[0])

    const chairRootA = new THREE.Group()
    chairRootA.position.set(0, CHAIR_BASE_HEIGHT, CHAIR_DISTANCE)
    chairRootA.rotation.y = Math.PI
    scene.add(chairRootA)
    const chairRootB = new THREE.Group()
    chairRootB.position.set(0, CHAIR_BASE_HEIGHT, -CHAIR_DISTANCE)
    scene.add(chairRootB)
    const setChairs = async (themeIndex) => {
      const theme = CHAIR_THEMES[themeIndex] || CHAIR_THEMES[0]
      const a = await loadMappedChair(renderer, theme)
      const b = a.clone(true)
      chairRootA.clear()
      chairRootB.clear()
      chairRootA.add(a)
      chairRootB.add(b)
    }
    void setChairs(chairThemeIdx)

    const boardRoot = new THREE.Group()
    scene.add(boardRoot)
    let loadedBoardModel = null

    const boardBase = new THREE.Mesh(
      new THREE.BoxGeometry(BOARD_HALF_X * 2, 0.12, BOARD_HALF_Z * 2),
      new THREE.MeshStandardMaterial({ color: '#744225', roughness: 0.5, metalness: 0.16 })
    )
    boardBase.position.y = BOARD_Y
    boardRoot.add(boardBase)

    const felt = new THREE.Mesh(
      new THREE.BoxGeometry(BOARD_HALF_X * 1.94, 0.03, BOARD_HALF_Z * 1.92),
      new THREE.MeshStandardMaterial({ color: '#174a32', roughness: 0.9, metalness: 0.02 })
    )
    felt.position.y = BOARD_Y + 0.1
    boardRoot.add(felt)

    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.06, BOARD_HALF_Z * 1.88),
      new THREE.MeshStandardMaterial({ color: '#5e3018', roughness: 0.6, metalness: 0.08 })
    )
    bar.position.y = BOARD_Y + 0.11
    boardRoot.add(bar)

    const makeTriangle = (x, top, dark) => {
      const baseZ = top ? -BOARD_HALF_Z + 0.01 : BOARD_HALF_Z - 0.01
      const apex = top ? -0.56 : 0.56
      const shape = new THREE.Shape()
      shape.moveTo(-0.08, 0)
      shape.lineTo(0.08, 0)
      shape.lineTo(0, apex)
      shape.closePath()
      const geom = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false })
      geom.rotateX(-Math.PI / 2)
      const tri = new THREE.Mesh(
        geom,
        new THREE.MeshStandardMaterial({ color: dark ? '#7a2f1d' : '#d8b07d', roughness: 0.72, metalness: 0.05 })
      )
      tri.position.set(x, BOARD_Y + 0.13, baseZ)
      boardRoot.add(tri)
    }

    for (let i = 0; i < 24; i += 1) {
      const p = pointBasePosition(i)
      makeTriangle(p.x, p.top, i % 2 === 0)
    }

    void loadBackgammonBoardModel(renderer).then((model) => {
      if (!model) return
      loadedBoardModel = model
      const box = new THREE.Box3().setFromObject(model)
      const size = box.getSize(new THREE.Vector3())
      const maxXZ = Math.max(size.x, size.z)
      const targetDiameter = TABLE_RADIUS * 1.68
      const scale = maxXZ > 0 ? targetDiameter / maxXZ : 1
      model.scale.multiplyScalar(scale)
      const scaledBox = new THREE.Box3().setFromObject(model)
      const center = scaledBox.getCenter(new THREE.Vector3())
      model.position.set(-center.x, TABLE_HEIGHT + 0.01 - scaledBox.min.y, -center.z)
      model.traverse((child) => {
        if (!child?.isMesh) return
        child.renderOrder = -1
      })
      scene.add(model)
    })

    const chipGroup = new THREE.Group()
    scene.add(chipGroup)

    const resize = () => {
      if (!host) return
      const width = host.clientWidth
      const height = host.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    window.addEventListener('resize', resize)

    let raf = 0
    const tick = () => {
      controls.update()
      renderer.render(scene, camera)
      raf = window.requestAnimationFrame(tick)
    }
    tick()

    sceneBundleRef.current = {
      scene,
      camera,
      renderer,
      controls,
      chipGroup,
      applyViewMode,
      applyTableFinish: (idx) => applyTableMaterials(table.parts, MURLAN_TABLE_FINISHES[idx] || MURLAN_TABLE_FINISHES[0]),
      applyHdri: (idx) => loadHdriEnvironment(scene, idx),
      applyQuality: (idx) => {
        const quality = QUALITY_OPTIONS[idx] || QUALITY_OPTIONS[1]
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio))
        renderer.shadowMap.enabled = Boolean(quality.shadows)
        renderer.shadowMap.needsUpdate = true
      },
      applyChairs: setChairs
    }

    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      controls.dispose()
      renderer.dispose()
      if (loadedBoardModel) {
        scene.remove(loadedBoardModel)
      }
      host.removeChild(renderer.domElement)
      sceneBundleRef.current = null
    }
  }, [])

  useEffect(() => {
    const bundle = sceneBundleRef.current
    if (!bundle?.applyViewMode) return
    bundle.applyViewMode(viewMode)
  }, [viewMode])

  useEffect(() => {
    const bundle = sceneBundleRef.current
    if (!bundle?.applyTableFinish) return
    bundle.applyTableFinish(tableFinishIdx)
  }, [tableFinishIdx])

  useEffect(() => {
    const bundle = sceneBundleRef.current
    if (!bundle?.applyHdri) return
    bundle.applyHdri(hdriIdx)
  }, [hdriIdx])

  useEffect(() => {
    const bundle = sceneBundleRef.current
    if (!bundle?.applyQuality) return
    bundle.applyQuality(qualityIdx)
  }, [qualityIdx])

  useEffect(() => {
    const bundle = sceneBundleRef.current
    if (!bundle?.applyChairs) return
    void bundle.applyChairs(chairThemeIdx)
  }, [chairThemeIdx])

  useEffect(() => {
    if (!winner) return
    playSfx(WIN_SOUND_URL, 0.9)
  }, [winner])

  useEffect(() => {
    const bundle = sceneBundleRef.current
    if (!bundle) return
    const { chipGroup } = bundle
    chipGroup.clear()

    const createChip = (color) => {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 0.045, 28),
        new THREE.MeshStandardMaterial({
          color: color === WHITE ? '#f2f2f2' : '#191919',
          roughness: 0.35,
          metalness: 0.18
        })
      )
      mesh.castShadow = true
      return mesh
    }

    for (let i = 0; i < 24; i += 1) {
      const point = game.points[i]
      if (!point.color || point.count <= 0) continue
      const base = pointBasePosition(i)
      for (let s = 0; s < point.count; s += 1) {
        const chip = createChip(point.color)
        const stack = Math.floor(s / 5)
        const layer = s % 5
        chip.position.set(
          base.x,
          BOARD_Y + 0.16 + layer * 0.07,
          base.z + (base.top ? 1 : -1) * (0.12 * stack)
        )
        chipGroup.add(chip)
      }
    }

    const makeBarChips = (count, color, zSign) => {
      for (let s = 0; s < count; s += 1) {
        const chip = createChip(color)
        chip.position.set(0, BOARD_Y + 0.16 + (s % 6) * 0.07, zSign * (0.08 + Math.floor(s / 6) * 0.12))
        chipGroup.add(chip)
      }
    }

    makeBarChips(game.bar.white, WHITE, -1)
    makeBarChips(game.bar.black, BLACK, 1)
  }, [game])

  const playAi = (stateAfterPlayer) => {
    const d1 = 1 + Math.floor(Math.random() * 6)
    const d2 = 1 + Math.floor(Math.random() * 6)
    const aiDice = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2]
    setMessage(`AI rolled ${d1} and ${d2}.`)
    setIsRollingDice(true)
    setAiThinking(true)

    setTimeout(() => {
      setIsRollingDice(false)
      const choice = pickAiSequence(stateAfterPlayer, aiDice)
      if (!choice || !choice.line.length) {
        setMessage(`AI rolled ${d1}/${d2} but had no legal move. Your turn.`)
        setAiThinking(false)
        setDice([])
        setAvailable([])
        return
      }
      setGame(choice.resultingState)
      playSfx(MOVE_SOUND_URL, 0.65)
      setMessage(`AI played ${choice.line.length} move(s). Your turn.`)
      setAiThinking(false)
      setDice([])
      setAvailable([])
    }, 700)
  }

  const roll = () => {
    if (aiThinking || winner || available.length > 0) return
    setIsRollingDice(true)
    const d1 = 1 + Math.floor(Math.random() * 6)
    const d2 = 1 + Math.floor(Math.random() * 6)
    const useDice = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2]
    setTimeout(() => {
      setIsRollingDice(false)
      playSfx(MOVE_SOUND_URL, 0.45)
      const seq = collectTurnSequences(game, WHITE, useDice)
      setDice(useDice)
      setAvailable(seq)
      if (!seq.length || !seq.some((s) => s.line.length)) {
        setMessage(`You rolled ${d1}/${d2} but no legal move. AI turn.`)
        playAi(game)
        return
      }
      setMessage('Tap a highlighted point button below to play your legal turn.')
    }, 650)
  }

  const handlePoint = (index) => {
    if (!available.length || aiThinking || winner) return
    const matching = available.find((s) => String(s.line[0]?.from) === String(index))
    if (!matching) return
    setGame(matching.resultingState)
    playSfx(MOVE_SOUND_URL, 0.65)
    setAvailable([])
    setDice([])
    setMessage('You played. AI is thinking…')
    playAi(matching.resultingState)
  }

  return (
    <div className="fixed inset-0 bg-[#060b16] px-3 py-3 text-white touch-none select-none">
      <div className="absolute top-20 left-4 z-20 flex flex-col items-start gap-3 pointer-events-none">
        <button
          type="button"
          onClick={() => setConfigOpen((open) => !open)}
          aria-expanded={configOpen}
          aria-label={configOpen ? 'Close game menu' : 'Open game menu'}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-gray-100 shadow-[0_6px_18px_rgba(2,6,23,0.45)] transition hover:border-white/30 hover:text-white"
        >
          <span className="text-base leading-none" aria-hidden="true">☰</span>
          <span className="leading-none">Menu</span>
        </button>
      </div>

      <div className="absolute top-20 right-4 z-20 flex flex-col items-end gap-3 pointer-events-none">
        <div className="pointer-events-auto flex flex-col items-end gap-3">
          <button
            type="button"
            onClick={() => setViewMode((mode) => (mode === '3d' ? '2d' : '3d'))}
            className="icon-only-button flex h-10 w-10 items-center justify-center text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-white/90 transition-opacity duration-200 hover:text-white focus:outline-none"
          >
            {viewMode === '3d' ? '2D' : '3D'}
          </button>
          <BottomLeftIcons
            showInfo={false}
            showChat={false}
            showGift={false}
            className="flex flex-col"
            buttonClassName="icon-only-button pointer-events-auto flex h-10 w-10 items-center justify-center text-white/90 transition-opacity duration-200 hover:text-white focus:outline-none"
            iconClassName="text-[1.5rem] leading-none"
            labelClassName="sr-only"
            muteIconOn="🔇"
            muteIconOff="🔊"
            order={['mute']}
          />
        </div>
      </div>

      {configOpen && (
        <div className="absolute top-32 right-4 z-30 pointer-events-auto mt-2 w-80 max-w-[86vw] rounded-2xl border border-white/15 bg-black/80 p-4 text-xs text-white shadow-2xl backdrop-blur">
          <div className="text-[10px] uppercase tracking-[0.4em] text-sky-200/80">Backgammon Settings</div>
          <div className="mt-2 text-white/70">Roll, select highlighted points, and bear off all 15 checkers to win.</div>
          <div className="mt-3 grid gap-2">
            <button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-left" onClick={() => setTableFinishIdx((v) => (v + 1) % MURLAN_TABLE_FINISHES.length)}>
              Table: {MURLAN_TABLE_FINISHES[tableFinishIdx]?.name || 'Default'}
            </button>
            <button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-left" onClick={() => setChairThemeIdx((v) => (v + 1) % CHAIR_THEMES.length)}>
              Chairs: {CHAIR_THEMES[chairThemeIdx]?.label || 'Royal Red'}
            </button>
            <button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-left" onClick={() => setHdriIdx((v) => (v + 1) % BACKGAMMON_HDRI_URLS.length)}>
              HDRI: {hdriIdx + 1}/{BACKGAMMON_HDRI_URLS.length}
            </button>
            <button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-left" onClick={() => setQualityIdx((v) => (v + 1) % QUALITY_OPTIONS.length)}>
              Graphics: {QUALITY_OPTIONS[qualityIdx]?.label || 'Balanced'}
            </button>
          </div>
        </div>
      )}

      <div className="absolute inset-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
        <div ref={canvasHostRef} className="h-full w-full" />
      </div>

      <div className="absolute top-[52%] left-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-wrap items-center justify-center gap-2 pointer-events-none">
        {dice.length > 0 || isRollingDice ? <Dice values={dice.length ? dice : [1, 1]} rolling={isRollingDice} transparent /> : null}
      </div>


      <div className="absolute bottom-20 left-1/2 z-20 grid w-[94vw] max-w-md -translate-x-1/2 grid-cols-6 gap-1">
        {Array.from({ length: 24 }, (_, i) => (
          <button
            key={`point-${i}`}
            type="button"
            onClick={() => handlePoint(i)}
            className={`rounded-lg border px-1 py-1 text-[10px] ${legalStarts.has(String(i)) ? 'border-cyan-300 bg-cyan-500/20' : 'border-white/15 bg-white/5'}`}
          >
            P{i + 1}
          </button>
        ))}
      </div>

      <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2">
        <button
          type="button"
          onClick={roll}
          disabled={aiThinking || winner || available.length > 0}
          className="rounded-xl border border-white/30 bg-transparent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Roll Dice
        </button>
      </div>

      <div className="pointer-events-auto">
        <BottomLeftIcons
          onGift={() => {}}
          showInfo={false}
          showChat={false}
          showMute={false}
          className="fixed right-3 bottom-48 z-50 flex flex-col gap-4"
          buttonClassName="icon-only-button pointer-events-auto flex h-11 w-11 items-center justify-center text-white/90 transition-opacity duration-200 hover:text-white focus:outline-none"
          iconClassName="text-[1.65rem] leading-none"
          labelClassName="sr-only"
          giftIcon="🎁"
          order={['gift']}
        />
        <BottomLeftIcons
          onChat={() => {}}
          showInfo={false}
          showGift={false}
          showMute={false}
          className="fixed left-3 bottom-48 z-50 flex flex-col"
          buttonClassName="icon-only-button pointer-events-auto flex h-11 w-11 items-center justify-center text-white/90 transition-opacity duration-200 hover:text-white focus:outline-none"
          iconClassName="text-[1.65rem] leading-none"
          labelClassName="sr-only"
          chatIcon="💬"
          order={['chat']}
        />
      </div>

      <div className="absolute inset-0 z-10 pointer-events-none">
        {players.map((player) => {
          const fallback = FALLBACK_SEAT_POSITIONS[player.index] || FALLBACK_SEAT_POSITIONS[0]
          const positionStyle = {
            position: 'absolute',
            left: fallback.left,
            top: fallback.top,
            transform: 'translate(-50%, -50%)'
          }
          return (
            <div
              key={`backgammon-seat-${player.index}`}
              className="absolute pointer-events-auto flex flex-col items-center"
              style={positionStyle}
            >
              <AvatarTimer
                index={player.index}
                photoUrl={player.photoUrl}
                active={player.isTurn}
                isTurn={player.isTurn}
                timerPct={1}
                name={player.name}
                color={player.color}
                size={1}
              />
              <span className="mt-1 text-[0.65rem] font-semibold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
                {player.name}
              </span>
            </div>
          )
        })}
      </div>

      <div className="absolute top-[61%] left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="px-5 py-2 rounded-full bg-[rgba(7,10,18,0.65)] border border-[rgba(255,215,0,0.25)] text-sm font-semibold backdrop-blur">
          {winner ? `${winner === WHITE ? 'You' : 'AI'} win!` : message}
        </div>
      </div>
    </div>
  )
}
