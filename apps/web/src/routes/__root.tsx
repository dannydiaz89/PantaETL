import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import appCss from '../styles.css?url'
import { LocaleProvider, useI18n } from '../locale-provider.js'
import { defaultI18n } from '../locales/index.js'
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
        title: defaultI18n.t('app.name'),
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
    <LocaleProvider>
      <LocalizedDocument>{children}</LocalizedDocument>
    </LocaleProvider>
  )
}

function LocalizedDocument({ children }: { children: React.ReactNode }) {
  const { locale } = useI18n()

  return (
    <html lang={locale}>
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
