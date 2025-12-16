import { LOGO_DATA_URL } from '../constants';

/**
 * Generate HTML body structure for login page
 * @returns HTML body content as string
 */
export function generateLoginHTMLBody(): string {
	return `
<body class="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  <div class="min-h-screen flex items-center justify-center p-6">
    <div class="max-w-md w-full animate-fade-in">
      <!-- Card Container -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-8 border border-gray-200 dark:border-gray-700">
        <!-- Logo & Brand -->
        <div class="flex flex-col items-center mb-8">
          <div class="mb-3">
            <img src="${LOGO_DATA_URL}" alt="Logo" width="64" height="64" style="object-fit: contain;" />
          </div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">R2 WebDAV</h2>
        </div>

        <!-- Title -->
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100 text-center mb-2">Welcome Back</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 text-center mb-10">Sign in to continue</p>

        <!-- Step 1: Username/Password -->
        <div id="step-password">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Username</label>
          <input
            id="login-username"
            type="text"
            class="input-field mb-5"
            placeholder="Enter username"
            autocomplete="username"
          />

          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Password</label>
          <input
            id="login-password"
            type="password"
            class="input-field mb-8"
            placeholder="Enter password"
            autocomplete="current-password"
          />

          <button id="btn-login" class="btn-primary">
            Sign In
          </button>
        </div>

        <!-- Step 2: 2FA Verification -->
        <div id="step-2fa" class="hidden">
          <div class="mb-8 p-3.5 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 rounded-lg">
            <p class="text-sm text-gray-700 dark:text-gray-300">
              Two-factor authentication required. Enter your verification code.
            </p>
          </div>

          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Verification Code</label>
          <input
            id="login-totp"
            type="text"
            class="input-field mb-5"
            placeholder="6-digit code"
            maxlength="6"
            autocomplete="one-time-code"
          />

          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recovery Code (optional)</label>
          <input
            id="login-recovery"
            type="text"
            class="input-field mb-8"
            placeholder="XXXX-XXXX"
            autocomplete="off"
          />

          <button id="btn-2fa" class="btn-primary">
            Verify
          </button>

          <button id="btn-back" class="btn-secondary mt-3">
            Back
          </button>
        </div>

        <!-- Divider -->
        <div class="relative my-8">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-200 dark:border-gray-700"></div>
          </div>
          <div class="relative flex justify-center text-xs">
            <span class="px-3 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium">OR</span>
          </div>
        </div>

        <!-- Passkey Login -->
        <button id="btn-passkey" class="btn-secondary flex items-center justify-center">
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M15 7a2 2 0 1 1 2-2 2 2 0 0 1-2 2Zm0 0v9m0 0-3 3m3-3 3 3"/>
          </svg>
          Sign in with Passkey
        </button>

        <!-- Error Display -->
        <div id="login-error" class="hidden mt-5 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 rounded-lg p-3.5"></div>

      </div>
    </div>
  </div>
`;
}
