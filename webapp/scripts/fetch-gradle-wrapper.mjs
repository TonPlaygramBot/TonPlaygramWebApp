import { createHash } from 'node:crypto'
import { spawn } from 'child_process'
import { createWriteStream } from 'fs'
import { mkdir, readFile, rename, rm } from 'fs/promises'
import { dirname, resolve } from 'path'
import https from 'https'
import { fileURLToPath, pathToFileURL } from 'url'

const WRAPPER_PATH = fileURLToPath(
  new URL('../android/gradle/wrapper/gradle-wrapper.jar', import.meta.url)
)
const WRAPPER_TMP_PATH = `${WRAPPER_PATH}.tmp`
const WRAPPER_URL =
  'https://raw.githubusercontent.com/gradle/gradle/v8.11.1/gradle/wrapper/gradle-wrapper.jar'

// Official checksum: https://gradle.org/release-checksums/#v8.11.1
export const WRAPPER_SHA256 = '2db75c40782f5e8ba1fc278a5574bab070adccb2d21ca5a6e5ed840888448046'
export const isPinnedWrapper = bytes => createHash('sha256').update(bytes).digest('hex') === WRAPPER_SHA256
async function hasValidWrapperJar () {
  try { return isPinnedWrapper(await readFile(WRAPPER_PATH)) } catch { return false }
}

function formatError (error) {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'code' in error) { return String(error.code) }
  return String(error)
}

async function downloadWithHttps () {
  await new Promise((resolve, reject) => {
    const file = createWriteStream(WRAPPER_TMP_PATH)
    https
      .get(WRAPPER_URL, (response) => {
        if (response.statusCode !== 200) {
          reject(
            new Error(
              `Unable to download Gradle wrapper (status ${response.statusCode})`
            )
          )
          response.resume()
          return
        }

        response.pipe(file)
        file.on('finish', () => {
          file.close(resolve)
        })
        file.on('error', reject)
      })
      .on('error', reject)
      .setTimeout(10000, function () { this.destroy(new Error('Wrapper download timed out')) })
  })
}

async function downloadWithCurl () {
  await new Promise((resolve, reject) => {
    const child = spawn('curl', [
      '--fail',
      '--max-time', '30',
      '--location',
      '--silent',
      '--show-error',
      '--output',
      WRAPPER_TMP_PATH,
      WRAPPER_URL
    ])

    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`curl exited with status ${code ?? 'unknown'}`))
    })
    child.on('error', reject)
  })
}

async function downloadJar () {
  await mkdir(dirname(WRAPPER_PATH), { recursive: true })
  await rm(WRAPPER_TMP_PATH, { force: true })

  try {
    await downloadWithHttps()
  } catch (error) {
    console.warn(
      `Direct Gradle wrapper download failed (${formatError(error)}); retrying with curl.`
    )
    await rm(WRAPPER_TMP_PATH, { force: true })
    await downloadWithCurl()
  }

  if (!isPinnedWrapper(await readFile(WRAPPER_TMP_PATH))) {
    throw new Error('Gradle wrapper SHA-256 does not match the pinned official release')
  }
  await rename(WRAPPER_TMP_PATH, WRAPPER_PATH)
}

async function ensureWrapper () {
  if (await hasValidWrapperJar()) return

  await downloadJar()
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  ensureWrapper().catch(async (error) => {
    process.exitCode = 1
    await rm(WRAPPER_TMP_PATH, { force: true })
    console.warn(
      'Gradle wrapper jar could not be downloaded automatically. Please download it manually if you need the Android build tools.'
    )
    console.warn(formatError(error))
  })
}
