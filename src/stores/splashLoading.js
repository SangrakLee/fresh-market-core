import { readonly, ref } from 'vue'

const isSplashVisible = ref(false)
const activeLoadingCount = ref(0)

let visibleSince = 0
let hideTimerId = null

const clearHideTimer = () => {
  if (!hideTimerId) return
  clearTimeout(hideTimerId)
  hideTimerId = null
}

const startSplashLoading = () => {
  activeLoadingCount.value += 1
  clearHideTimer()

  if (isSplashVisible.value) return

  isSplashVisible.value = true
  visibleSince = Date.now()
}

const stopSplashLoading = ({ minDuration = 500 } = {}) => {
  activeLoadingCount.value = Math.max(0, activeLoadingCount.value - 1)

  if (activeLoadingCount.value > 0) return

  const elapsed = Date.now() - visibleSince
  const remaining = Math.max(0, minDuration - elapsed)

  clearHideTimer()
  hideTimerId = setTimeout(() => {
    if (activeLoadingCount.value === 0) {
      isSplashVisible.value = false
    }
  }, remaining)
}

const withSplashLoading = async (task, options) => {
  startSplashLoading()
  try {
    return await task()
  } finally {
    stopSplashLoading(options)
  }
}

export const useSplashLoading = () => {
  return {
    isSplashVisible: readonly(isSplashVisible),
    startSplashLoading,
    stopSplashLoading,
    withSplashLoading,
  }
}
