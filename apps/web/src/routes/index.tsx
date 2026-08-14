import { createFileRoute } from '@tanstack/react-router'

import { requireSession } from '../auth/route-guard.js'
import { TopLevelPage } from '../components/top-level-page.js'
import { useI18n } from '../locale-provider.js'

export const Route = createFileRoute('/')({ beforeLoad: requireSession, component: Home })

function Home() {
  const { t } = useI18n()
  return <TopLevelPage description={t('overview.description')} eyebrow={t('app.name')} title={t('overview.title')} />
}
