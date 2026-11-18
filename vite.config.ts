import { defineConfig } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
export default defineConfig({ base: '/', plugins:[{
  name: 'release-metadata',
  transformIndexHtml(html) {
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
    const configured = process.env.SITE_URL || (host ? 'https://' + host : '');
    const origin = configured ? new URL(configured).origin : '';
    if (origin && !origin.startsWith('https://')) throw new Error('SITE_URL must use HTTPS.');
    const safe = origin.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
    const imageOrigin = process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL ? new URL('https://' + process.env.VERCEL_URL).origin : origin;
    const imageSafe = imageOrigin.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
    return html.replaceAll('__SITE_ORIGIN__', imageSafe).replace('</head>', (safe ? '<link rel="canonical" href="' + safe + '/" /><meta property="og:url" content="' + safe + '/" />' : '') + '</head>');
  },
},{
  name:'local-review-recording',
  configureServer(server) {
    server.middlewares.use('/__recording', async (req,res)=>{
      if(req.method!=='POST'){res.statusCode=405;res.end();return;}
      const chunks: Buffer[]=[];
      for await(const chunk of req) chunks.push(Buffer.from(chunk));
      await mkdir('.qa',{recursive:true});
      const extension=req.headers['content-type']==='video/x-ivf'?'ivf':'webm';
      await writeFile(`.qa/construction-1x.${extension}`,Buffer.concat(chunks));
      res.end('saved');
    });
  }
}] });
