const fs = require('fs');

const content = `export const environment = {
  production: true,
  supabaseUrl: '${process.env.NG_APP_SUPABASE_URL ?? ''}',
  supabaseKey: '${process.env.NG_APP_SUPABASE_ANON_KEY ?? ''}',
};
`;

fs.mkdirSync('src/environments', { recursive: true });
fs.writeFileSync('src/environments/environment.ts', content);
console.log('environment.ts generated');
