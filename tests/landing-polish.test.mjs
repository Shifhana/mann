import{test}from'node:test';import assert from'node:assert/strict';import{landingOffset}from'../src/temple/landing-prototype.ts';import{landingVoice}from'../src/temple/landing-audio.ts';import{createTempleDefinition}from'../src/temple/model.ts';import{refineCollectible}from'../src/temple/refine-collectible.ts';import{createFullConstruction,prominentLandings}from'../src/temple/full-construction.ts';
const definition=refineCollectible(createTempleDefinition()),events=createFullConstruction(definition.pieces);
test('impact retains accelerating gravity until contact; damped response never penetrates or hovers',()=>{
 for(const m of events){const a=landingOffset(m,m.contact-20),b=landingOffset(m,m.contact-10),c=landingOffset(m,m.contact);assert.ok(a-b<b-c);assert.equal(c,0);
  let peak=0;for(let t=m.contact;t<m.settled;t+=.5){const y=landingOffset(m,t);assert.ok(y>=0);peak=Math.max(peak,y);}assert.ok(peak<(m.bounceHeight??0)*.6);
  assert.equal(landingOffset(m,m.settled),0);assert.equal(landingOffset(m,5000),0);
  const dt=.01,near=landingOffset(m,m.settled-dt)/dt;assert.ok(near<.006);
 }
});
test('recorded impact and locking timbres vary with mass, speed and visibility without random timing',()=>{
 const m=events[0],small=landingVoice({...m,volume:2,visibility:1,impactSpeed:90},'contact',0),large=landingVoice({...m,volume:128,visibility:1,impactSpeed:240},'contact',0),hidden=landingVoice({...m,volume:128,visibility:.2,impactSpeed:240},'contact',0);
 assert.ok(large.pitch<small.pitch);assert.ok(large.level>small.level);assert.ok(hidden.level<large.level*.6);
 assert.ok(landingVoice(m,'lock',0).sampleIndex>=3);assert.ok(small.sampleIndex<3);
 assert.deepEqual(landingVoice(m,'contact',4),landingVoice(m,'contact',4));
 assert.ok(prominentLandings(events).filter(m=>(m.visibility??0)>=.75).length>15);
});
