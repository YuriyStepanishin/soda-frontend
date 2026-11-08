const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const exported={};
const source=ts.transpileModule(fs.readFileSync(require.resolve('../src/theme/theme.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
new Function('exports',source)(exported);
test('explicit light/dark selection overrides the system; invalid storage follows system',()=>{
  assert.equal(exported.resolveTheme('light',true),'light');
  assert.equal(exported.resolveTheme('dark',false),'dark');
  assert.equal(exported.resolveTheme(null,true),'dark');
  assert.equal(exported.resolveTheme('broken',false),'light');
});
test('theme updates DOM and browser chrome, persists only its own device preference',()=>{
  const values=new Map();let meta;let event;
  global.localStorage={setItem:(key,value)=>values.set(key,value)};
  global.document={documentElement:{dataset:{}},querySelector:()=>({setAttribute:(key,value)=>{meta=value;}})};
  global.window={dispatchEvent:value=>{event=value.type;}};
  exported.applyTheme('dark');
  assert.equal(exported.currentTheme(),'dark');assert.equal(meta,'#06162e');
  assert.deepEqual([...values],[['soda:theme','dark']]);assert.equal(event,'soda:theme-change');
  exported.applyTheme('light',false);assert.equal(exported.currentTheme(),'light');assert.equal(meta,'#f6f8fb');assert.equal(values.get('soda:theme'),'dark');
});
test('blocked storage still allows switching for the current visit',()=>{
  global.localStorage={setItem:()=>{throw Error('blocked');}};
  exported.applyTheme('dark');assert.equal(exported.currentTheme(),'dark');
});
test('OS theme changes apply only before an explicit choice; subscriptions clean up',()=>{
  const handlers=new Map();const mediaHandlers=new Map();let saved=null;
  const media={matches:true,addEventListener:(key,fn)=>mediaHandlers.set(key,fn),removeEventListener:key=>mediaHandlers.delete(key)};
  global.localStorage={getItem:()=>saved,setItem:(_key,value)=>{saved=value;}};
  global.window={matchMedia:()=>media,dispatchEvent:event=>handlers.get(event.type)?.(event),addEventListener:(key,fn)=>handlers.set(key,fn),removeEventListener:key=>handlers.delete(key)};
  const cleanup=exported.subscribeTheme(()=>{});
  exported.initializeTheme();assert.equal(exported.currentTheme(),'dark');
  media.matches=false;mediaHandlers.get('change')();assert.equal(exported.currentTheme(),'light');
  exported.applyTheme('dark');mediaHandlers.get('change')();assert.equal(exported.currentTheme(),'dark');
  cleanup();assert.equal(handlers.size,0);assert.equal(mediaHandlers.size,0);
});
