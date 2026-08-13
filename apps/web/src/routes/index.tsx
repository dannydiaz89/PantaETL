import { createFileRoute } from '@tanstack/react-router'

import { TopLevelPage } from '../components/top-level-page.js'
import { useI18n } from '../locale-provider.js'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const { t } = useI18n()
  return <TopLevelPage description={t('overview.description')} eyebrow={t('app.name')} title={t('overview.title')} />
}
