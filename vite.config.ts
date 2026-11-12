import { defineConfig } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
export default defineConfig({ base: './', plugins:[{
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
