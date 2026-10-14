import fs from 'fs';

const indexHtmlTemplate = `<!doctype html>
<html lang="ko" class="dark">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="./music.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>찬양팀 콘티 도우미 - Praise Helper</title>
    <style>
      @font-face {
        font-family: 'Jua';
        src: url('./fonts/Jua-Regular.ttf') format('truetype');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }
      * {
        font-family: 'Jua', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      /* Custom scrollbar */
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      html.dark ::-webkit-scrollbar-track {
        background: #09090b;
      }
      html.dark ::-webkit-scrollbar-thumb {
        background: #27272a;
        border-radius: 4px;
      }
      html.dark ::-webkit-scrollbar-thumb:hover {
        background: #3f3f46;
      }
      html.light ::-webkit-scrollbar-track {
        background: #f8fafc;
      }
      html.light ::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;
      }
      html.light ::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }
    </style>
  </head>
  <body class="bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 antialiased select-none overflow-hidden h-screen w-screen transition-colors duration-200">
    <div id="root" class="h-full w-full"></div>
    <script type="module" src="./src/main.tsx"></script>
  </body>
</html>
`;

fs.writeFileSync('index.html', indexHtmlTemplate, 'utf8');
console.log('[prepare-build] index.html set to src/main.tsx entry');
