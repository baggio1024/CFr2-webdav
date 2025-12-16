import { FAVICON_DATA_URL } from '../constants';
import { TAILWIND_CSS } from '../../tailwindInline';

/**
 * Generate HTML structure for file explorer
 * @param title - Page title
 * @param scriptContent - JavaScript code to inject
 * @returns Complete HTML document as string
 */
export function generateFileExplorerHTMLStructure(title: string, scriptContent: string): string {
	const safeTitle = title || 'R2 WebDAV';

	return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <link rel="icon" type="image/png" href="${FAVICON_DATA_URL}" />
  <style>${TAILWIND_CSS}</style>
  <style>
    * { box-sizing: border-box; }
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    .animate-fade-in { animation: fade 0.2s ease-in; }
    @keyframes fade { from {opacity: 0;} to {opacity: 1;} }
  </style>
</head>
<body class="bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-100">
  <div id="app" class="min-h-screen flex flex-col"></div>
  <script>
${scriptContent}
  </script>
</body>
</html>
`;
}
