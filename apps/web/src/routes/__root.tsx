import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import { t } from '../locales/index.js'
import appCss from '../styles.css?url'
import { ThemeProvider } from '../theme-provider.js'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: t('app.name'),
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>

        <Scripts />
      </body>
    </html>
  )
}
