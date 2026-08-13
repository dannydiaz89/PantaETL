import { createFileRoute } from '@tanstack/react-router'

import { t } from '../locales/index.js'
import { TopLevelPage } from '../components/top-level-page.js'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return <TopLevelPage description={t('overview.description')} eyebrow={t('app.name')} title={t('overview.title')} />
}
