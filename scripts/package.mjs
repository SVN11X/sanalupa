import {execFileSync} from 'node:child_process';
// Optional maintainer packaging command, uses Python 3 standard library; never needed by visitors.
execFileSync('python3',['-c',`
from pathlib import Path
import zipfile
root=Path.cwd();target=root.parent/'salud-cerca-santiago.zip'
excluded={'node_modules','.git','.sites-runtime','test-results','playwright-report','private','__pycache__'}
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(root.rglob('*')):
  if not p.is_file() or any(x in excluded for x in p.relative_to(root).parts):continue
  if p.name.startswith('.env') or p.suffix in ('.tmp','.log'):continue
  z.write(p,root.name+'/'+str(p.relative_to(root)))
print(str(target))
`],{stdio:'inherit'});
