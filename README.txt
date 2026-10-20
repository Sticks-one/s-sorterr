Deploy (Netlify Drop does not run functions, so use one of these):
A) Push this folder to GitHub, then Netlify > Add new site > Import from Git. Build settings are read from netlify.toml.
B) Or with the CLI: npm i -g netlify-cli && netlify deploy --prod
After deploying: Site settings > Environment variables > add ADMIN_PASSWORD (needed to delete entries), then redeploy.
