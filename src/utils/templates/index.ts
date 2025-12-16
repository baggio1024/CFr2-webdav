// Re-export all public functions from the templates module

// File Explorer
export { generateHTML } from './fileExplorer/generateHTML';

// Error Page
export { generateErrorHTML } from './errorPage';

// Login Page
export { generateLoginHTML } from './loginPage/generateLoginHTML';

// Constants (if needed by consumers)
export { FAVICON_DATA_URL, LOGO_DATA_URL } from './constants';

// Translations (if needed by consumers)
export { TRANSLATIONS, type Language, type TranslationKey, type Translations } from './translations';
