'use client';

import { Content, Theme, Header, HeaderName } from '@carbon/react';
import './globals.scss';

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <body>
        <Theme theme='g100'>
          <Header aria-label='AI Agent Testing Suite'>
            <HeaderName prefix='AI'>Agent Testing Suite</HeaderName>
          </Header>
          <Content>
            {children}
          </Content>
        </Theme>
      </body>
    </html>
  );
}
