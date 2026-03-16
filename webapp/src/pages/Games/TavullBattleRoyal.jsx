import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import BottomLeftIcons from '../../components/BottomLeftIcons.jsx'
import AvatarTimer from '../../components/AvatarTimer.jsx'
import { getGameVolume, isGameMuted } from '../../utils/sound.js'
import QuickMessagePopup from '../../components/QuickMessagePopup.jsx'
import GiftPopup from '../../components/GiftPopup.jsx'
import { CHESS_CHAIR_OPTIONS } from '../../config/chessBattleInventoryConfig.js'
import {
  POOL_ROYALE_DEFAULT_HDRI_ID,
  POOL_ROYALE_HDRI_VARIANTS,
  POOL_ROYALE_HDRI_VARIANT_MAP
} from '../../config/poolRoyaleInventoryConfig.js'
import { chessBattleAccountId, getChessBattleInventory, isChessOptionUnlocked } from '../../utils/chessBattleInventory.js'
import {
  BLACK,
  WHITE,
  applyMove,
  collectTurnSequences,
  formatMove,
  initialBoard,
  pickAiSequence
} from '../../utils/tavullEngine.js'

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
const DEFAULT_HDRI_ASSET =
  POOL_ROYALE_HDRI_VARIANT_MAP[POOL_ROYALE_DEFAULT_HDRI_ID] || POOL_ROYALE_HDRI_VARIANTS[0] || null
let sharedKtx2Loader = null
let hasDetectedKtx2Support = false
const CHAIR_MODEL_URLS = Object.freeze([
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/SheenChair/glTF-Binary/SheenChair.glb',
  '/assets/models/chair/chair.glb',
  '/assets/models/chair/chair.gltf'
])
const CHAIR_THEMES = Object.freeze([
  ...CHESS_CHAIR_OPTIONS
])
const QUALITY_OPTIONS = Object.freeze([
  { id: 'performance', label: 'Performance', pixelRatio: 1, shadows: false },
  { id: 'balanced', label: 'Balanced', pixelRatio: 1.5, shadows: true },
  { id: 'ultra', label: 'Ultra', pixelRatio: 2, shadows: true }
])
const MOVE_SOUND_URL = 'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Move.mp3'
const WIN_SOUND_URL = 'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/End.mp3'
const DICE_ROLL_SOUND_URL = '/assets/sounds/dice-roll.mp3'
const FALLBACK_SEAT_POSITIONS = [
  { left: '50%', top: '18%' },
  { left: '50%', top: '73%' }
]
const BACKGAMMON_BOARD_MODEL_URLS = Object.freeze([
  '/assets/models/backgammon/backgammon-board.glb',
  '/assets/models/backgammon/backgammon-board.gltf'
])

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

function resolveHdriUrlsByVariantIndex(preferredIndex = 0) {
  const variant = POOL_ROYALE_HDRI_VARIANTS[preferredIndex] || DEFAULT_HDRI_ASSET
  if (!variant?.assetId) {
    return ['https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/colorful_studio_2k.hdr']
  }
  const resolutions = Array.isArray(variant.preferredResolutions) && variant.preferredResolutions.length
    ? variant.preferredResolutions
    : ['2k']
  const ordered = [...resolutions, variant.fallbackResolution, '2k', '1k'].filter(Boolean)
  const unique = [...new Set(ordered)]
  return unique.map((resolution) => `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/${resolution}/${variant.assetId}_${resolution}.hdr`)
}

function loadHdriEnvironment(scene, preferredIndex = 0) {
  const rgbe = new RGBELoader()
  const ordered = resolveHdriUrlsByVariantIndex(preferredIndex)
  const tryNext = (index = 0) => {
    if (index >= ordered.length) return
    rgbe.load(
      ordered[index],
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping
        scene.environment = texture
      },
      undefined,
      () => tryNext(index + 1)
    )
  }
  tryNext(0)
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
  const navigate = useNavigate()
  useTelegramBackButton()
  const canvasHostRef = useRef(null)
  const sceneBundleRef = useRef(null)
  const isMountedRef = useRef(true)
  const pendingTimeoutsRef = useRef([])

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
  const [showChat, setShowChat] = useState(false)
  const [showGift, setShowGift] = useState(false)
  const [chatBubbles, setChatBubbles] = useState([])
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [inventoryVersion, setInventoryVersion] = useState(0)
  const [activeMoveHighlight, setActiveMoveHighlight] = useState(null)
  const accountId = chessBattleAccountId()
  const chessInventory = useMemo(() => getChessBattleInventory(accountId), [accountId, inventoryVersion])
  const playerName = getTelegramFirstName() || 'Player'
  const playerAvatar = getTelegramPhotoUrl()

  const winner = game.off.white >= 15 ? WHITE : game.off.black >= 15 ? BLACK : null

  const players = [
    {
      index: 0,
      id: 'self-player',
      name: playerName,
      photoUrl: playerAvatar || '/assets/icons/profile.svg',
      color: 'white',
      isTurn: !aiThinking && !winner
    },
    {
      index: 1,
      id: 'ai-royal',
      name: 'AI Royal',
      photoUrl: '/assets/icons/profile.svg',
      color: 'black',
      isTurn: aiThinking
    }
  ]


  const ownedChairOptions = useMemo(
    () => CHAIR_THEMES.filter((option) => isChessOptionUnlocked('chairColor', option.id, chessInventory)),
    [chessInventory]
  )
  const ownedHdriOptions = useMemo(
    () => POOL_ROYALE_HDRI_VARIANTS.filter((option) => isChessOptionUnlocked('environmentHdri', option.id, chessInventory)),
    [chessInventory]
  )
  const ownedFinishOptions = useMemo(
    () => MURLAN_TABLE_FINISHES.filter((option) => isChessOptionUnlocked('tableFinish', option.id, chessInventory)),
    [chessInventory]
  )

  useEffect(() => {
    const onInventoryUpdate = () => setInventoryVersion((v) => v + 1)
    window.addEventListener('chessBattleInventoryUpdate', onInventoryUpdate)
    return () => window.removeEventListener('chessBattleInventoryUpdate', onInventoryUpdate)
  }, [])

  useEffect(() => {
    if (!ownedFinishOptions.length) return
    if (!ownedFinishOptions[tableFinishIdx]) setTableFinishIdx(0)
  }, [ownedFinishOptions, tableFinishIdx])

  useEffect(() => {
    if (!ownedChairOptions.length) return
    if (!ownedChairOptions[chairThemeIdx]) setChairThemeIdx(0)
  }, [ownedChairOptions, chairThemeIdx])

  useEffect(() => {
    if (!ownedHdriOptions.length) return
    if (!ownedHdriOptions[hdriIdx]) setHdriIdx(0)
  }, [ownedHdriOptions, hdriIdx])

  const playSfx = (url, volumeScale = 1) => {
    if (isGameMuted() || !soundEnabled) return
    try {
      const audio = new Audio(url)
      audio.volume = Math.min(1, getGameVolume() * volumeScale)
      void audio.play().catch(() => {})
    } catch {}
  }

  useEffect(() => {
    isMountedRef.current = true
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

    loadHdriEnvironment(scene, 0)

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

    const loadBackgammonBoardModel = async () => {
      const loader = createConfiguredGLTFLoader(renderer)
      for (const url of BACKGAMMON_BOARD_MODEL_URLS) {
        try {
          const gltf = await loader.loadAsync(url)
          const model = gltf?.scene || gltf?.scenes?.[0]
          if (!model) continue
          prepareLoadedModel(model)
          model.position.set(0, BOARD_Y + 0.1, 0)
          model.scale.setScalar(0.85)
          boardRoot.add(model)
          return true
        } catch {
          // Try next URL and fallback to procedural board.
        }
      }
      return false
    }

    void loadBackgammonBoardModel().then((loaded) => {
      if (loaded) return

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
    })

    const chipGroup = new THREE.Group()
    scene.add(chipGroup)
    const diceGroup = new THREE.Group()
    scene.add(diceGroup)
    const diceAnimationState = { entries: [] }
    const maxDice = 4

    const makeDie = () => {
      const die = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, 0.1),
        new THREE.MeshStandardMaterial({ color: '#f5efe2', roughness: 0.4, metalness: 0.08 })
      )
      die.visible = false
      die.castShadow = true
      return die
    }
    const diceMeshes = Array.from({ length: maxDice }, () => {
      const mesh = makeDie()
      diceGroup.add(mesh)
      return mesh
    })

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
      const now = performance.now()
      diceAnimationState.entries = diceAnimationState.entries.filter((entry) => {
        const elapsed = now - entry.start
        const t = Math.min(1, elapsed / entry.duration)
        const eased = 1 - (1 - t) ** 3
        const arc = Math.sin(Math.PI * t) * 0.18
        entry.mesh.position.lerpVectors(entry.startPos, entry.endPos, eased)
        entry.mesh.position.y += arc
        entry.mesh.rotation.x += 0.42
        entry.mesh.rotation.y += 0.37
        entry.mesh.rotation.z += 0.25
        if (t >= 1) {
          entry.mesh.rotation.set((Math.random() - 0.5) * 0.2, Math.random() * Math.PI, (Math.random() - 0.5) * 0.2)
          return false
        }
        return true
      })
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
      animateDiceThrow: (values = [], seat = 0) => {
        const diceValues = Array.isArray(values) && values.length ? values : [1, 1]
        const startZ = seat === 0 ? BOARD_HALF_Z - 0.05 : -BOARD_HALF_Z + 0.05
        const endZ = seat === 0 ? BOARD_HALF_Z * 0.18 : -BOARD_HALF_Z * 0.18
        const spacing = 0.16
        const centerOffset = (diceValues.length - 1) / 2
        diceMeshes.forEach((mesh, index) => {
          if (index >= diceValues.length) {
            mesh.visible = false
            return
          }
          mesh.visible = true
          const x = (index - centerOffset) * spacing
          const startPos = new THREE.Vector3(x, BOARD_Y + 0.24, startZ)
          const endPos = new THREE.Vector3(x * 0.75, BOARD_Y + 0.17, endZ)
          mesh.position.copy(startPos)
          diceAnimationState.entries.push({
            mesh,
            start: performance.now() + index * 60,
            duration: 720,
            startPos,
            endPos
          })
        })
      },
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
      if (host.contains(renderer.domElement)) host.removeChild(renderer.domElement)
      sceneBundleRef.current = null
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => () => {
    pendingTimeoutsRef.current.forEach((id) => window.clearTimeout(id))
    pendingTimeoutsRef.current = []
    isMountedRef.current = false
  }, [])

  useEffect(() => {
    const bundle = sceneBundleRef.current
    if (!bundle?.applyViewMode) return
    bundle.applyViewMode(viewMode)
  }, [viewMode])

  useEffect(() => {
    const bundle = sceneBundleRef.current
    if (!bundle?.applyTableFinish) return
    const selected = ownedFinishOptions[tableFinishIdx] || ownedFinishOptions[0]
    const globalIdx = MURLAN_TABLE_FINISHES.findIndex((option) => option.id === selected?.id)
    bundle.applyTableFinish(globalIdx >= 0 ? globalIdx : 0)
  }, [tableFinishIdx, ownedFinishOptions])

  useEffect(() => {
    const bundle = sceneBundleRef.current
    if (!bundle?.applyHdri) return
    const selected = ownedHdriOptions[hdriIdx] || ownedHdriOptions[0]
    const globalIdx = POOL_ROYALE_HDRI_VARIANTS.findIndex((option) => option.id === selected?.id)
    bundle.applyHdri(globalIdx >= 0 ? globalIdx : 0)
  }, [hdriIdx, ownedHdriOptions])

  useEffect(() => {
    const bundle = sceneBundleRef.current
    if (!bundle?.applyQuality) return
    bundle.applyQuality(qualityIdx)
  }, [qualityIdx])

  useEffect(() => {
    const bundle = sceneBundleRef.current
    if (!bundle?.applyChairs) return
    const selected = ownedChairOptions[chairThemeIdx] || ownedChairOptions[0]
    const globalIdx = CHAIR_THEMES.findIndex((option) => option.id === selected?.id)
    void bundle.applyChairs(globalIdx >= 0 ? globalIdx : 0)
  }, [chairThemeIdx, ownedChairOptions])

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

    const highlightTargets = new Set()
    available.forEach((sequence) => {
      sequence?.line?.forEach((move) => {
        if (typeof move?.from === 'number') highlightTargets.add(move.from)
        if (typeof move?.to === 'number') highlightTargets.add(move.to)
      })
    })
    if (activeMoveHighlight) {
      if (typeof activeMoveHighlight.from === 'number') highlightTargets.add(activeMoveHighlight.from)
      if (typeof activeMoveHighlight.to === 'number') highlightTargets.add(activeMoveHighlight.to)
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
      if (highlightTargets.has(i)) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.11, 0.012, 8, 28),
          new THREE.MeshStandardMaterial({
            color: activeMoveHighlight ? '#f59e0b' : '#22d3ee',
            emissive: activeMoveHighlight ? '#7c2d12' : '#164e63',
            emissiveIntensity: 1.2,
            roughness: 0.3,
            metalness: 0.2
          })
        )
        ring.rotation.x = Math.PI / 2
        ring.position.set(base.x, BOARD_Y + 0.145, base.z + (base.top ? -0.06 : 0.06))
        chipGroup.add(ring)
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
  }, [game, available, activeMoveHighlight])

  const animateSequence = (state, color, sequence, onDone) => {
    const line = sequence?.line || []
    if (!line.length) {
      onDone?.(state)
      return
    }
    let idx = 0
    let currentState = state
    const runStep = () => {
      if (!isMountedRef.current) return
      const move = line[idx]
      setActiveMoveHighlight({ from: move.from, to: move.to, color })
      currentState = applyMove(currentState, color, move)
      setGame(currentState)
      playSfx(MOVE_SOUND_URL, 0.65)
      idx += 1
      if (idx < line.length) {
        const timeoutId = window.setTimeout(runStep, 320)
        pendingTimeoutsRef.current.push(timeoutId)
      } else {
        const timeoutId = window.setTimeout(() => {
          setActiveMoveHighlight(null)
          onDone?.(currentState)
        }, 220)
        pendingTimeoutsRef.current.push(timeoutId)
      }
    }
    runStep()
  }

  const playAi = (stateAfterPlayer) => {
    const d1 = 1 + Math.floor(Math.random() * 6)
    const d2 = 1 + Math.floor(Math.random() * 6)
    const aiDice = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2]
    setMessage(`AI rolled ${d1} and ${d2}.`)
    setIsRollingDice(true)
    setAiThinking(true)
    sceneBundleRef.current?.animateDiceThrow?.(aiDice, 1)
    playSfx(DICE_ROLL_SOUND_URL, 0.75)

    const timeoutId = window.setTimeout(() => {
      if (!isMountedRef.current) return
      setIsRollingDice(false)
      let choice = null
      try {
        choice = pickAiSequence(stateAfterPlayer, aiDice)
      } catch (error) {
        console.error('Backgammon AI turn crashed, skipping turn safely.', error)
      }
      if (!choice || !choice.line.length) {
        setMessage(`AI rolled ${d1}/${d2} but had no legal move. Your turn.`)
        setAiThinking(false)
        setDice([])
        setAvailable([])
        return
      }
      animateSequence(stateAfterPlayer, BLACK, choice, () => {
        setMessage(`AI played ${choice.line.length} move(s). Your turn.`)
        setAiThinking(false)
        setDice([])
        setAvailable([])
      })
    }, 700)
    pendingTimeoutsRef.current.push(timeoutId)
  }

  const roll = () => {
    if (aiThinking || winner || available.length > 0) return
    setIsRollingDice(true)
    const d1 = 1 + Math.floor(Math.random() * 6)
    const d2 = 1 + Math.floor(Math.random() * 6)
    const useDice = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2]
    sceneBundleRef.current?.animateDiceThrow?.(useDice, 0)
    playSfx(DICE_ROLL_SOUND_URL, 0.75)
    const timeoutId = window.setTimeout(() => {
      if (!isMountedRef.current) return
      setIsRollingDice(false)
      playSfx(MOVE_SOUND_URL, 0.45)
      let seq = []
      try {
        seq = collectTurnSequences(game, WHITE, useDice)
      } catch (error) {
        console.error('Backgammon player turn evaluation crashed.', error)
      }
      setDice(useDice)
      setAvailable(seq)
      if (!seq.length || !seq.some((s) => s.line.length)) {
        setMessage(`You rolled ${d1}/${d2} but no legal move. AI turn.`)
        playAi(game)
        return
      }
      setMessage('Pick one legal turn from the move list.')
    }, 650)
    pendingTimeoutsRef.current.push(timeoutId)
  }

  const handleSequence = (sequence) => {
    if (!available.length || aiThinking || winner) return
    if (!sequence?.line?.length) return
    setAvailable([])
    setDice([])
    setMessage('Moving checkers…')
    animateSequence(game, WHITE, sequence, (stateAfterPlayer) => {
      setMessage('You played. AI is thinking…')
      playAi(stateAfterPlayer)
    })
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
        <div className="absolute top-32 right-4 z-30 pointer-events-auto mt-2 w-72 max-w-[80vw] rounded-2xl border border-white/15 bg-black/80 p-4 text-xs text-white shadow-2xl backdrop-blur max-h-[80vh] overflow-y-auto pr-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.4em] text-sky-200/80">Backgammon Settings</p>
              <p className="mt-1 text-[0.7rem] text-white/70">Royal menu with the same options flow as Chess Battle Royal.</p>
            </div>
            <button
              type="button"
              onClick={() => setConfigOpen(false)}
              className="rounded-full p-1 text-white/70 transition hover:text-white"
              aria-label="Close settings"
            >✕</button>
          </div>
          <div className="mt-4 space-y-3">
            <label className="flex items-center justify-between text-[0.7rem] text-gray-200">
              <span>Sound effects</span>
              <input type="checkbox" className="h-4 w-4" checked={soundEnabled} onChange={(event) => setSoundEnabled(event.target.checked)} />
            </label>
            <button
              type="button"
              onClick={() => navigate('/store/tavullbattleroyal')}
              className="w-full rounded-lg border border-emerald-300/60 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100"
            >
              Open Store
            </button>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[10px] uppercase tracking-[0.35em] text-white/70">Personalize Arena</p>
              <p className="mt-1 text-[0.7rem] text-white/60">Only owned items are shown here.</p>
              <div className="mt-3 grid gap-2">
                <button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-left" onClick={() => setTableFinishIdx((v) => (v + 1) % Math.max(1, ownedFinishOptions.length))}>
                  Table Finish: {ownedFinishOptions[tableFinishIdx]?.label || ownedFinishOptions[0]?.label || 'Default'}
                </button>
                <button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-left" onClick={() => setChairThemeIdx((v) => (v + 1) % Math.max(1, ownedChairOptions.length))}>
                  Chair Theme: {ownedChairOptions[chairThemeIdx]?.label || ownedChairOptions[0]?.label || 'Royal'}
                </button>
                <button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-left" onClick={() => setHdriIdx((v) => (v + 1) % Math.max(1, ownedHdriOptions.length))}>
                  Environment: {ownedHdriOptions[hdriIdx]?.name || ownedHdriOptions[0]?.name || 'Studio'}
                </button>
                <button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-left" onClick={() => setQualityIdx((v) => (v + 1) % QUALITY_OPTIONS.length)}>
                  Graphics: {QUALITY_OPTIONS[qualityIdx]?.label || 'Balanced'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="absolute inset-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
        <div ref={canvasHostRef} className="h-full w-full" />
      </div>

      {available.length > 0 && (
        <div className="absolute bottom-32 left-1/2 z-30 w-[94vw] max-w-md -translate-x-1/2 rounded-xl border border-white/15 bg-black/70 p-2 text-[10px] backdrop-blur">
          <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-cyan-200">Legal turns</div>
          <div className="max-h-28 space-y-1 overflow-y-auto">
            {available.map((seq, idx) => (
              <button key={`seq-${idx}`} type="button" onClick={() => handleSequence(seq)} className="block w-full rounded border border-cyan-300/40 bg-cyan-500/10 px-2 py-1 text-left">
                {seq.line.map((move) => formatMove(move)).join(' • ')}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="absolute left-1/2 top-[73%] z-20 flex translate-x-5 -translate-y-1/2">
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
          onGift={() => setShowGift(true)}
          showInfo={false}
          showChat={false}
          showMute={false}
          className="fixed right-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-50 flex flex-col gap-4"
          buttonClassName="icon-only-button pointer-events-auto flex h-11 w-11 items-center justify-center text-white/90 transition-opacity duration-200 hover:text-white focus:outline-none"
          iconClassName="text-[1.65rem] leading-none"
          labelClassName="sr-only"
          giftIcon="🎁"
          order={['gift']}
        />
        <BottomLeftIcons
          onChat={() => setShowChat(true)}
          showInfo={false}
          showGift={false}
          showMute={false}
          className="fixed left-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-50 flex flex-col"
          buttonClassName="icon-only-button pointer-events-auto flex h-11 w-11 items-center justify-center text-white/90 transition-opacity duration-200 hover:text-white focus:outline-none"
          iconClassName="text-[1.65rem] leading-none"
          labelClassName="sr-only"
          chatIcon="💬"
          order={['chat']}
        />
      </div>

      {chatBubbles.map((bubble) => (
        <div key={bubble.id} className="chat-bubble chess-battle-chat-bubble">
          <span>{bubble.text}</span>
          <img src={bubble.photoUrl} alt="avatar" className="w-5 h-5 rounded-full" />
        </div>
      ))}

      <QuickMessagePopup
        open={showChat}
        onClose={() => setShowChat(false)}
        title="Quick Chat"
        onSend={(text) => {
          const id = Date.now()
          setChatBubbles((bubbles) => [...bubbles, { id, text, photoUrl: playerAvatar || '/assets/icons/profile.svg' }])
          setTimeout(() => setChatBubbles((bubbles) => bubbles.filter((bubble) => bubble.id !== id)), 3000)
        }}
      />

      <GiftPopup
        open={showGift}
        onClose={() => setShowGift(false)}
        players={players}
        senderIndex={0}
      />

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
