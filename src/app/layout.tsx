'use client';

import React from 'react';
import { Content, Theme, Header, HeaderName } from '@carbon/react';
import { AppDataProvider } from '@/lib/AppDataContext';
import AppSideNav from './components/SideNav';
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
            <AppSideNav />
          </Header>
          <Content>
            <AppDataProvider>
              <div style={{ display: 'flex', marginLeft: '16rem' }}>
                <main style={{ flex: 1, padding: '2rem' }}>{children}</main>
              </div>
            </AppDataProvider>
          </Content>
        </Theme>
      </body>
    </html>
  );
}
