import fs from 'node:fs';
import {roles,getRoleDefaults} from '../src/roles.js';
const data=Object.fromEntries(roles.map(role=>[role.id,Object.fromEntries(['zh-TW','zh-CN','en','ja'].map(language=>[language,getRoleDefaults(role.id,language)]))]));
fs.writeFileSync(new URL('../src/role-defaults.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
