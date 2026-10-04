import { request } from './api'
import { NOTIFICATIONS } from '@/data/seed'
import { commit } from './store'

export const notificationService = {
  list: () => request(() => NOTIFICATIONS),
  markRead: (id: string) =>
    request(() => {
      const n = NOTIFICATIONS.find((x) => x.id === id)
      if (n) n.read = true
      commit()
      return n ?? null
    }),
  markAllRead: () =>
    request(() => {
      NOTIFICATIONS.forEach((n) => (n.read = true))
      commit()
      return NOTIFICATIONS
    }),
}
