/**
 * Utilitário de Renderização de Views com Layout Master EJS
 * Aurora Business Lab - Porto Aurora 2031
 */

import path from 'node:path';
import ejs from 'ejs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewsDir = path.resolve(__dirname, '../../views');

export function setupViewRenderer(app) {
  app.use((req, res, next) => {
    res.renderApp = (viewName, data = {}) => {
      const templatePath = path.resolve(viewsDir, `${viewName}.ejs`);
      const layoutPath = path.resolve(viewsDir, 'layout.ejs');

      const mergedData = {
        ...res.locals,
        ...data,
        currentUser: req.session ? req.session.user : null,
        csrfToken: res.locals.csrfToken || ''
      };

      ejs.renderFile(templatePath, mergedData, (err, renderedBody) => {
        if (err) {
          console.error(`Erro ao renderizar template ${viewName}:`, err);
          return res.status(500).send(`Erro ao renderizar template: ${err.message}`);
        }

        ejs.renderFile(layoutPath, { ...mergedData, body: renderedBody }, (layoutErr, fullHtml) => {
          if (layoutErr) {
            console.error('Erro ao renderizar layout master:', layoutErr);
            return res.status(500).send(`Erro no layout master: ${layoutErr.message}`);
          }
          res.send(fullHtml);
        });
      });
    };
    next();
  });
}
