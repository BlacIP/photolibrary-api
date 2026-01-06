export const swaggerThemeScript = `
        window.addEventListener('load', function() {
            const btn = document.createElement('button');
            btn.innerHTML = '🌙';
            btn.style.cssText = 'position: fixed; top: 10px; right: 20px; z-index: 10000; padding: 8px 12px; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; cursor: pointer; font-family: sans-serif; font-weight: bold; box-shadow: 0 2px 5px rgba(0,0,0,0.2); transition: all 0.3s;';
            btn.onmouseover = function() { this.style.opacity = '0.9'; };

            function updateTheme() {
                const isDark = document.body.classList.contains('dark-mode');
                btn.innerHTML = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
                btn.style.background = isDark ? '#fff' : '#1a1a1a';
                btn.style.color = isDark ? '#1a1a1a' : '#fff';
                btn.style.borderColor = isDark ? '#ccc' : '#555';
            }

            btn.onclick = function() {
                document.body.classList.toggle('dark-mode');
                localStorage.setItem('swagger-theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
                updateTheme();
            };

            document.body.appendChild(btn);

            if (localStorage.getItem('swagger-theme') === 'dark') {
                document.body.classList.add('dark-mode');
            }
            updateTheme();
        });
    `;

export const swaggerUiOptions = {
  customCss: `
      .swagger-ui .topbar { display: none }

      /* Dark Mode Styles */
      body.dark-mode, .dark-mode .swagger-ui { background-color: #1a1a1a; color: #e0e0e0; }
      .dark-mode .swagger-ui .info .title, .dark-mode .swagger-ui .info h1, .dark-mode .swagger-ui .info h2, .dark-mode .swagger-ui .info h3, .dark-mode .swagger-ui .info h4, .dark-mode .swagger-ui .info h5 { color: #fff; }
      .dark-mode .swagger-ui .opblock .opblock-summary-operation-id, .dark-mode .swagger-ui .opblock .opblock-summary-path, .dark-mode .swagger-ui .opblock .opblock-summary-path__deprecated { color: #fff; }
      .dark-mode .swagger-ui .opblock-tag { color: #fff; }
      .dark-mode .swagger-ui .scheme-container { background-color: #2a2a2a; box-shadow: none; border-bottom: 1px solid #333; }
      .dark-mode .swagger-ui .opblock .opblock-section-header { background-color: #2a2a2a; color: #e0e0e0; }
      .dark-mode .swagger-ui .tab li { color: #e0e0e0; }
      .dark-mode .swagger-ui .response-col_status { color: #e0e0e0; }
      .dark-mode .swagger-ui table thead tr td, .dark-mode .swagger-ui table thead tr th { color: #e0e0e0; border-bottom: 1px solid #333; }
      .dark-mode .swagger-ui .parameter__name { color: #e0e0e0; }
      .dark-mode .swagger-ui .parameter__type { color: #aaa; }
      .dark-mode .swagger-ui select { color: #000; }
      .dark-mode .swagger-ui input, .dark-mode .swagger-ui textarea { background-color: #333; color: #fff; border: 1px solid #444; }
      .dark-mode .swagger-ui .model { color: #e0e0e0; }
      .dark-mode .swagger-ui .prop-type { color: #9cdcfe; }
      .dark-mode .swagger-ui .prop-format { color: #aaa; }
      .dark-mode .swagger-ui .model-title { color: #e0e0e0; }
    `,
  customSiteTitle: 'PhotoLibrary API Documentation',
  customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.18.2/swagger-ui.min.css',
  customJs: [
    'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.18.2/swagger-ui-bundle.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.18.2/swagger-ui-standalone-preset.min.js',
    '/api-docs/theme.js',
  ],
  swaggerOptions: {
    url: '/api-docs.json',
  },
};
