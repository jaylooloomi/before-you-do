import test from 'node:test';import assert from 'node:assert/strict';import {matchesShortcutEvent} from '../src/shortcut-match.js';
test('manager shortcut guard matches physical keys and exact configured modifiers',()=>{
 const altH={code:'KeyH',key:'h',altKey:true};assert(matchesShortcutEvent(altH,{modifier:'alt',key:'H'}));
 assert(!matchesShortcutEvent({...altH,ctrlKey:true},{modifier:'alt',key:'H'}));assert(!matchesShortcutEvent({...altH,shiftKey:true},{modifier:'alt',key:'H'}));assert(!matchesShortcutEvent({...altH,metaKey:true},{modifier:'alt',key:'H'}));
 assert(matchesShortcutEvent({code:'KeyJ',key:'j',ctrlKey:true,shiftKey:true},{modifier:'ctrlShift',key:'J'}));
 assert(matchesShortcutEvent({code:'Space',key:' ',altKey:true},{modifier:'alt',key:'Space'}));
 assert(matchesShortcutEvent({code:'Digit1',key:'!',altKey:true,shiftKey:true},{modifier:'altShift',key:'1'}));
 assert(!matchesShortcutEvent({code:'KeyH',key:'h'},{modifier:'alt',key:'H'}));
});
