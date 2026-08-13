import { createFileRoute } from '@tanstack/react-router'

import { t } from '../locales/index.js'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main>
      <h1>{t('overview.title')}</h1>
      <p>{t('overview.description')}</p>
    </main>
  )
}
