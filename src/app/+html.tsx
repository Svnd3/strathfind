import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#7B0323" />
        <meta
          name="description"
          content="StrathFind is a private, campus-verified lost-and-found for students."
        />
        <meta name="robots" content="index,follow" />
        <title>StrathFind — Campus lost and found</title>
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
      </head>
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        {children}
      </body>
    </html>
  );
}

const responsiveBackground = `
body { background: #F2ECE8; }
#root { display: flex; min-height: 100vh; }
.skip-link {
  position: fixed;
  z-index: 9999;
  top: 8px;
  left: 8px;
  transform: translateY(-160%);
  padding: 12px 16px;
  border-radius: 10px;
  color: #FFFDFC;
  background: #7B0323;
  font: 600 16px/1.25 system-ui, sans-serif;
}
.skip-link:focus { transform: translateY(0); }
`;
