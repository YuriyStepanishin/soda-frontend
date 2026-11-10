import test from 'node:test';
import assert from 'node:assert/strict';
import {backDestination} from '../src/utils/navigation.ts';
const context={page:'receivables',salesByDaysOrigin:'home',showGallery:false,showStoreSelector:false,hasSelectedStore:false};
test('fixed Back returns from receivables and top-level sections to home',()=>{
  for(const page of ['receivables','sales','route-history','motivation','messages']) assert.equal(backDestination({...context,page}),'home');
});
test('fixed Back respects the sales-by-days origin',()=>{
  assert.equal(backDestination({...context,page:'sales-by-days',salesByDaysOrigin:'sales'}),'sales');
  assert.equal(backDestination({...context,page:'sales-by-days',salesByDaysOrigin:'home'}),'home');
});
test('fixed Back exits one nested photo workflow level at a time',()=>{
  assert.equal(backDestination({...context,showGallery:true}),'close-gallery');
  assert.equal(backDestination({...context,showStoreSelector:true,hasSelectedStore:true}),'select-store');
  assert.equal(backDestination({...context,showStoreSelector:true,hasSelectedStore:false}),'close-selector');
});
