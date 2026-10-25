import {afterEach,vi} from 'vitest';
import {cleanup} from './utilities.js';
Object.defineProperty(Element.prototype,'scrollIntoView',{value:vi.fn(),configurable:true});
// jsdom lacks native dialog methods; browser E2E covers real modal semantics.
HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
afterEach(()=>{cleanup();vi.restoreAllMocks();});
