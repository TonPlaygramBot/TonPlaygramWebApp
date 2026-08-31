import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const registrations = new Map()
let registeredWebApp = null

export const resolveBackFallbackPath = (pathname) => {
  if (!pathname || pathname === '/') return '/'

  if (pathname.startsWith('/games/')) {
    const segments = pathname.split('/').filter(Boolean)
    const gameSlug = segments[1]

    if (segments.length >= 3 && segments[2] === 'lobby') return '/games'
    if (gameSlug) return `/games/${gameSlug}/lobby`
    return '/games'
  }

  return '/'
}

const hasInAppBackHistory = () => {
  const idx = window.history.state?.idx
  return typeof idx === 'number' ? idx > 0 : window.history.length > 1
}

const getActiveRegistration = () => Array.from(registrations.values()).at(-1)

const handleBackButton = () => {
  getActiveRegistration()?.handleBack()
}

const syncBackButton = () => {
  const webApp = window.Telegram?.WebApp

  if (registeredWebApp && registeredWebApp !== webApp) {
    registeredWebApp.offEvent('backButtonClicked', handleBackButton)
    registeredWebApp.BackButton.hide()
    registeredWebApp = null
  }

  if (!webApp) return

  if (!registeredWebApp) {
    webApp.onEvent('backButtonClicked', handleBackButton)
    registeredWebApp = webApp
  }

  if (getActiveRegistration()?.shouldHandleBack) {
    webApp.BackButton.show()
  } else {
    webApp.BackButton.hide()
  }
}

/**
 * Connects a routed screen to both Telegram's back control and the native
 * Android/iOS phone back control exposed by our Capacitor Telegram shim.
 * Multiple screens may opt in safely: one shared listener dispatches only to
 * the most recently mounted screen, so a game confirmation can override the
 * site-wide navigation behavior without causing a double navigation.
 */
export default function useTelegramBackButton (onBackOrFallback) {
  const navigate = useNavigate()
  const location = useLocation()
  const registrationKey = useRef(Symbol('phone-back-registration'))
  const callbackRef = useRef(null)

  callbackRef.current =
    typeof onBackOrFallback === 'function' ? onBackOrFallback : null

  useEffect(() => {
    const fallbackOverride =
      typeof onBackOrFallback === 'string' && onBackOrFallback.trim()
        ? onBackOrFallback.trim()
        : null
    const fallbackPath =
      fallbackOverride || resolveBackFallbackPath(location.pathname)
    const key = registrationKey.current

    registrations.set(key, {
      shouldHandleBack: Boolean(callbackRef.current) || location.pathname !== '/',
      handleBack: () => {
        if (callbackRef.current) {
          callbackRef.current()
        } else if (hasInAppBackHistory()) {
          navigate(-1)
        } else if (location.pathname !== fallbackPath) {
          navigate(fallbackPath, { replace: true })
        }
      }
    })
    syncBackButton()

    return () => {
      registrations.delete(key)
      syncBackButton()
    }
  }, [location.key, location.pathname, navigate, onBackOrFallback])
}
