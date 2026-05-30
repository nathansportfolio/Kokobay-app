import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { palette } from '@/constants/theme';

/**
 * Web root — fill the viewport so letterboxing does not show a dark browser gutter.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root {
                height: 100%;
                width: 100%;
                margin: 0;
                padding: 0;
                background-color: ${palette.canvas};
              }
              body { overflow: hidden; }
              #root { display: flex; flex: 1; }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
