/**
 * Custom CSS styles for login page
 */
export const LOGIN_STYLES = `
    * { box-sizing: border-box; }
    .animate-fade-in { animation: fade 0.4s ease-out; }
    @keyframes fade { from {opacity: 0; transform: translateY(-8px);} to {opacity: 1; transform: translateY(0);} }
    .btn-primary {
      width: 100%;
      padding: 0.75rem;
      background-color: var(--color-gray-900);
      color: var(--color-white);
      border-radius: var(--radius-lg);
      font-weight: var(--font-weight-medium);
      box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1);
      transition: all 0.15s cubic-bezier(0.4,0,0.2,1);
    }
    .btn-primary:hover {
      background-color: var(--color-gray-800);
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
    }
    @media (prefers-color-scheme: dark) {
      .btn-primary {
        background-color: var(--color-white);
        color: var(--color-gray-900);
      }
      .btn-primary:hover {
        background-color: var(--color-gray-100);
      }
    }
    .btn-secondary {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid var(--color-gray-300);
      border-radius: var(--radius-lg);
      color: var(--color-gray-700);
      font-weight: var(--font-weight-medium);
      box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1);
      transition: all 0.15s cubic-bezier(0.4,0,0.2,1);
    }
    .btn-secondary:hover {
      background-color: var(--color-gray-50);
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
    }
    @media (prefers-color-scheme: dark) {
      .btn-secondary {
        border-color: var(--color-gray-700);
        color: var(--color-gray-300);
      }
      .btn-secondary:hover {
        background-color: var(--color-gray-800);
      }
    }
    .input-field {
      width: 100%;
      padding: 0.625rem 1rem;
      border-radius: var(--radius-lg);
      border: 2px solid var(--color-gray-300);
      background-color: var(--color-white);
      color: var(--color-gray-900);
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.06);
      transition: all 0.15s cubic-bezier(0.4,0,0.2,1);
    }
    .input-field:focus {
      outline: none;
      border-color: var(--color-blue-500);
      box-shadow: 0 0 0 2px rgba(48,128,255,0.5);
    }
    @media (prefers-color-scheme: dark) {
      .input-field {
        border-color: var(--color-gray-600);
        background-color: var(--color-gray-800);
        color: var(--color-gray-100);
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
      }
      .input-field:focus {
        border-color: var(--color-blue-400);
        box-shadow: 0 0 0 2px rgba(48,128,255,0.4);
      }
    }
`;
