// Web Push 購読ヘルパー

export async function subscribePush(sessionId: string, role: 'customer' | 'owner'): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false

  try {
    // 通知許可をリクエスト
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    // Service Worker 登録
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    // 既存購読 or 新規購読
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })
    }

    // サーバーに保存
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, role, subscription: sub.toJSON() }),
    })

    return true
  } catch (e) {
    console.error('push subscribe failed:', e)
    return false
  }
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const arr = new Uint8Array([...rawData].map(c => c.charCodeAt(0)))
  return arr.buffer
}
