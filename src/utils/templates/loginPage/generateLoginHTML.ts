import { FAVICON_DATA_URL } from '../constants';
import { TAILWIND_CSS } from '../../tailwindInline';
import { LOGIN_STYLES } from './loginStyles';
import { generateLoginScript } from './loginScripts';
import { generateLoginHTMLBody } from './loginStructure';

/**
 * Generate login page with modern authentication
 * - Username/Password → JWT tokens
 * - 2FA verification support
 * - WebAuthn Passkey authentication
 * - Token auto-refresh and session management
 */
export function generateLoginHTML(): string {
	const SESSION_KEY = 'app_session';
	const scriptContent = generateLoginScript(SESSION_KEY);
	const bodyContent = generateLoginHTMLBody();

	return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Login - R2 WebDAV</title>
  <link rel="icon" type="image/png" href="${FAVICON_DATA_URL}" />
  <style>${TAILWIND_CSS}</style>
  <style>
${LOGIN_STYLES}
  </style>
</head>
${bodyContent}
  <script>
${scriptContent}
  </script>
</body>
</html>
`;
}
