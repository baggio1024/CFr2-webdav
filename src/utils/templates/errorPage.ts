import { FAVICON_DATA_URL } from './constants';

/**
 * Generate error page HTML
 * @param title - Error page title
 * @param message - Error message to display
 * @returns HTML string for error page
 */
export function generateErrorHTML(title: string, message: string): string {
	return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <link rel="icon" type="image/png" href="${FAVICON_DATA_URL}">
          <style>
              body {
                  font-family: Arial, sans-serif;
                  line-height: 1.6;
                  margin: 0;
                  padding: 20px;
                  background-color: #f4f4f4;
              }
              h1 {
                  color: #333;
              }
              .error-message {
                  background-color: white;
                  border-radius: 5px;
                  padding: 20px;
                  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                  color: #e60000;
              }
          </style>
      </head>
      <body>
          <h1>${title}</h1>
          <div class="error-message">
              ${message}
          </div>
      </body>
      </html>
    `;
}
